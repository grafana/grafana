import { cloneDeep, isFunction } from 'lodash';

import { config } from '@grafana/runtime';

import { forbiddenElements } from './constants';
import { logWarning } from './utils';

/**
 * Distortions are near-membrane mechanisms to altert JS instrics and DOM APIs.
 *
 * Everytime a plugin tries to use a js instricis (e.g. Array.concat) or a DOM API (e.g. document.createElement)
 * or access any of its attributes a distortion callback is used.
 *
 * The distortion callback has a single parameter which is usually the "native" function responsible
 * for the API, but generally speaking is the value that the plugin would normally get. Note that here by
 * "value" we mean the function the plugin would execute, not the value from executing the function.
 *
 * To compare the native code passed to the distortion callback and know if should we distorted or not we need
 * to get the object descriptors of these native functions using Object.getOwnPropertyDescriptors.
 *
 * For example:
 *
 * If the distortionCallback is asking for a distortion for the `Array.concat` function
 * one will see `ƒ concat() { [native code] }` as the parameter to the distortion callback.
 *
 * Inside the callback we could compare this with the descriptor value:
 *
 * ```
 * function distortionCallback(valueToDistort: unknown){
 *   const descriptor = Object.getOwnPropertyDescriptors(Array.prototype, 'concat')
 *   if (descriptor.value === valueToDistort) {
 *      // distorted replacement function
 *      return ArrayConcatReplacementFunction;
 *   }
 *   // original
 *   return valueToDistort;
 * }
 * ```
 *
 * To avoid the verbosity of the previous code as more and more distortions are applied it is easier to use
 * a Map. Map keys can be objects (including native functions).
 *
 * This allows to simplify the previous code:
 *
 * ```
 * function distortionCallback(valueToDistort: unknown){
 *   if (generalDistortionMap.has(valueToDistort)) {
 *      // Map does the comparison easier
 *      return generalDistortionMap.get(valueToDistort);
 *   }
 *   // original
 *   return valueToDistort;
 * }
 * ```
 *
 * The code in this file defines that generalDistortionMap.
 */

type DistortionMap = Map<unknown, (originalAttrOrMethod: unknown, pluginId: string) => unknown>;
const generalDistortionMap: DistortionMap = new Map();

const monitorOnly = Boolean(config.featureToggles.frontendSandboxMonitorOnly);

export function getGeneralSandboxDistortionMap() {
  if (generalDistortionMap.size === 0) {
    // initialize the distortion map
    distortIframeAttributes(generalDistortionMap);
    distortConsole(generalDistortionMap);
    distortAlert(generalDistortionMap);
    distortAppend(generalDistortionMap);
    distortInsert(generalDistortionMap);
    distortInnerHTML(generalDistortionMap);
    distortCreateElement(generalDistortionMap);
    distortWorkers(generalDistortionMap);
    distortDocument(generalDistortionMap);
  }
  return generalDistortionMap;
}

function failToSet(originalAttrOrMethod: unknown, pluginId: string) {
  logWarning(`Plugin ${pluginId} tried to set a sandboxed property`, {
    pluginId,
    attrOrMethod: String(originalAttrOrMethod),
    entity: 'window',
  });
  if (monitorOnly) {
    return originalAttrOrMethod;
  }
  return () => {
    throw new Error('Plugins are not allowed to set sandboxed properties');
  };
}

// sets distortion to protect iframe elements
function distortIframeAttributes(distortions: DistortionMap) {
  const iframeHtmlForbiddenProperties = ['contentDocument', 'contentWindow', 'src', 'srcdoc', 'srcObject', 'srcset'];

  for (const property of iframeHtmlForbiddenProperties) {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, property);
    if (descriptor) {
      function fail(originalAttrOrMethod: unknown, pluginId: string) {
        logWarning(`Plugin ${pluginId} tried to access iframe.${property}`, {
          pluginId,
          attrOrMethod: property,
          entity: 'iframe',
        });

        if (monitorOnly) {
          return originalAttrOrMethod;
        }

        return () => {
          throw new Error('iframe.' + property + ' is not allowed in sandboxed plugins');
        };
      }

      if (descriptor.value) {
        distortions.set(descriptor.value, fail);
      }
      if (descriptor.set) {
        distortions.set(descriptor.set, fail);
      }
      if (descriptor.get) {
        distortions.set(descriptor.get, fail);
      }
    }
  }
}

// set distortions to always prefix any usage of console
function distortConsole(distortions: DistortionMap) {
  const descriptor = Object.getOwnPropertyDescriptor(window, 'console');
  if (descriptor?.value) {
    function getSandboxConsole(originalAttrOrMethod: unknown, pluginId: string) {
      // we don't monitor the console because we expect a high volume of calls
      if (monitorOnly) {
        return originalAttrOrMethod;
      }

      function sandboxLog(...args: unknown[]) {
        console.log(`[plugin ${pluginId}]`, ...args);
      }
      return {
        log: sandboxLog,
        warn: sandboxLog,
        error: sandboxLog,
        info: sandboxLog,
        debug: sandboxLog,
        table: sandboxLog,
      };
    }

    distortions.set(descriptor.value, getSandboxConsole);
  }
  if (descriptor?.set) {
    distortions.set(descriptor.set, failToSet);
  }
}

// set distortions to alert to always output to the console
function distortAlert(distortions: DistortionMap) {
  function getAlertDistortion(originalAttrOrMethod: unknown, pluginId: string) {
    logWarning(`Plugin ${pluginId} accessed window.alert`, {
      pluginId,
      attrOrMethod: 'alert',
      entity: 'window',
    });

    if (monitorOnly) {
      return originalAttrOrMethod;
    }

    return function (...args: unknown[]) {
      console.log(`[plugin ${pluginId}]`, ...args);
    };
  }
  const descriptor = Object.getOwnPropertyDescriptor(window, 'alert');
  if (descriptor?.value) {
    distortions.set(descriptor.value, getAlertDistortion);
  }
  if (descriptor?.set) {
    distortions.set(descriptor.set, failToSet);
  }
}

function distortInnerHTML(distortions: DistortionMap) {
  function getInnerHTMLDistortion(originalMethod: unknown, pluginId: string) {
    return function innerHTMLDistortion(this: HTMLElement, ...args: string[]) {
      for (const arg of args) {
        const lowerCase = arg?.toLowerCase() || '';
        for (const forbiddenElement of forbiddenElements) {
          if (lowerCase.includes('<' + forbiddenElement)) {
            logWarning(`Plugin ${pluginId} tried to set ${forbiddenElement} in innerHTML`, {
              pluginId,
              attrOrMethod: 'innerHTML',
              param: forbiddenElement,
              entity: 'HTMLElement',
            });

            if (monitorOnly) {
              continue;
            }
            throw new Error('<' + forbiddenElement + '> is not allowed in sandboxed plugins');
          }
        }
      }

      if (isFunction(originalMethod)) {
        originalMethod.apply(this, args);
      }
    };
  }
  const descriptors = [
    Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML'),
    Object.getOwnPropertyDescriptor(Element.prototype, 'outerHTML'),
    Object.getOwnPropertyDescriptor(Element.prototype, 'insertAdjacentHTML'),
    Object.getOwnPropertyDescriptor(DOMParser.prototype, 'parseFromString'),
  ];

  for (const descriptor of descriptors) {
    if (descriptor?.set) {
      distortions.set(descriptor.set, getInnerHTMLDistortion);
    }
    if (descriptor?.value) {
      distortions.set(descriptor.value, getInnerHTMLDistortion);
    }
  }
}

function distortCreateElement(distortions: DistortionMap) {
  function getCreateElementDistortion(originalMethod: unknown, pluginId: string) {
    return function createElementDistortion(this: HTMLElement, arg?: string, options?: unknown) {
      if (arg && forbiddenElements.includes(arg)) {
        logWarning(`Plugin ${pluginId} tried to create ${arg}`, {
          pluginId,
          attrOrMethod: 'createElement',
          param: arg,
          entity: 'document',
        });
        if (!monitorOnly) {
          return document.createDocumentFragment();
        }
      }
      if (isFunction(originalMethod)) {
        return originalMethod.apply(this, [arg, options]);
      }
    };
  }
  const descriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'createElement');
  if (descriptor?.value) {
    distortions.set(descriptor.value, getCreateElementDistortion);
  }
}

function distortInsert(distortions: DistortionMap) {
  function getInsertDistortion(originalMethod: unknown, pluginId: string) {
    return function insertChildDistortion(this: HTMLElement, node?: Node, ref?: Node) {
      const nodeType = node?.nodeName?.toLowerCase() || '';

      if (node && forbiddenElements.includes(nodeType)) {
        logWarning(`Plugin ${pluginId} tried to insert ${nodeType}`, {
          pluginId,
          attrOrMethod: 'insertChild',
          param: nodeType,
          entity: 'HTMLElement',
        });
        if (!monitorOnly) {
          return document.createDocumentFragment();
        }
      }
      if (isFunction(originalMethod)) {
        return originalMethod.call(this, node, ref);
      }
    };
  }

  function getinsertAdjacentElementDistortion(originalMethod: unknown, pluginId: string) {
    return function insertAdjacentElementDistortion(this: HTMLElement, position?: string, node?: Node) {
      const nodeType = node?.nodeName?.toLowerCase() || '';
      if (node && forbiddenElements.includes(nodeType)) {
        logWarning(`Plugin ${pluginId} tried to insert ${nodeType}`, {
          pluginId,
          attrOrMethod: 'insertAdjacentElement',
          param: nodeType,
          entity: 'HTMLElement',
        });

        if (!monitorOnly) {
          return document.createDocumentFragment();
        }
      }
      if (isFunction(originalMethod)) {
        return originalMethod.call(this, position, node);
      }
    };
  }

  const descriptors = [
    Object.getOwnPropertyDescriptor(Node.prototype, 'insertBefore'),
    Object.getOwnPropertyDescriptor(Node.prototype, 'replaceChild'),
  ];

  for (const descriptor of descriptors) {
    if (descriptor?.value) {
      distortions.set(descriptor.set, getInsertDistortion);
    }
  }

  const descriptorAdjacent = Object.getOwnPropertyDescriptor(Element.prototype, 'insertAdjacentElement');
  if (descriptorAdjacent?.value) {
    distortions.set(descriptorAdjacent.set, getinsertAdjacentElementDistortion);
  }
}

// set distortions to append elements to the document
function distortAppend(distortions: DistortionMap) {
  // append accepts an array of nodes to append https://developer.mozilla.org/en-US/docs/Web/API/Node/append
  function getAppendDistortion(originalMethod: unknown, pluginId: string) {
    return function appendDistortion(this: HTMLElement, ...args: Node[]) {
      let acceptedNodes = args;
      const filteredAcceptedNodes = args?.filter((node) => !forbiddenElements.includes(node.nodeName.toLowerCase()));
      if (!monitorOnly) {
        acceptedNodes = filteredAcceptedNodes;
      }

      if (acceptedNodes.length !== filteredAcceptedNodes.length) {
        logWarning(`Plugin ${pluginId} tried to append fobiddenElements`, {
          pluginId,
          attrOrMethod: 'append',
          param: args?.filter((node) => forbiddenElements.includes(node.nodeName.toLowerCase()))?.join(',') || '',
          entity: 'HTMLElement',
        });
      }

      if (isFunction(originalMethod)) {
        originalMethod.apply(this, acceptedNodes);
      }
      // https://developer.mozilla.org/en-US/docs/Web/API/Element/append#return_value
      return undefined;
    };
  }

  // appendChild accepts a single node to add https://developer.mozilla.org/en-US/docs/Web/API/Node/appendChild
  function getAppendChildDistortion(originalMethod: unknown, pluginId: string) {
    return function appendChildDistortion(this: HTMLElement, arg?: Node) {
      const nodeType = arg?.nodeName?.toLowerCase() || '';
      if (arg && forbiddenElements.includes(nodeType)) {
        logWarning(`Plugin ${pluginId} tried to append ${nodeType}`, {
          pluginId,
          attrOrMethod: 'appendChild',
          param: nodeType,
          entity: 'HTMLElement',
        });

        if (!monitorOnly) {
          return document.createDocumentFragment();
        }
      }
      if (isFunction(originalMethod)) {
        return originalMethod.call(this, arg);
      }
    };
  }

  const descriptors = [
    Object.getOwnPropertyDescriptor(Element.prototype, 'append'),
    Object.getOwnPropertyDescriptor(Element.prototype, 'prepend'),
    Object.getOwnPropertyDescriptor(Element.prototype, 'after'),
    Object.getOwnPropertyDescriptor(Element.prototype, 'before'),
    Object.getOwnPropertyDescriptor(Document.prototype, 'append'),
    Object.getOwnPropertyDescriptor(Document.prototype, 'prepend'),
  ];

  for (const descriptor of descriptors) {
    if (descriptor?.value) {
      distortions.set(descriptor.value, getAppendDistortion);
    }
  }

  const appendChildDescriptor = Object.getOwnPropertyDescriptor(Node.prototype, 'appendChild');
  if (appendChildDescriptor?.value) {
    distortions.set(appendChildDescriptor.value, getAppendChildDistortion);
  }
}

// this is not a distortion for security reasons but to make plugins using web workers work correctly.
function distortWorkers(distortions: DistortionMap) {
  const descriptor = Object.getOwnPropertyDescriptor(Worker.prototype, 'postMessage');
  function getPostMessageDistortion(originalMethod: unknown) {
    return function postMessageDistortion(this: Worker, ...args: unknown[]) {
      // proxies can't be serialized by postMessage algorithm
      // the only way to pass it through is to send a cloned version
      // objects passed to postMessage should be clonable
      try {
        const newArgs: unknown[] = cloneDeep(args);
        if (isFunction(originalMethod)) {
          originalMethod.apply(this, newArgs);
        }
      } catch (e) {
        throw new Error('postMessage arguments are invalid objects');
      }
    };
  }
  if (descriptor?.value) {
    distortions.set(descriptor.value, getPostMessageDistortion);
  }
}

// this is not a distortion for security reasons but to make plugins using document.defaultView work correctly.
function distortDocument(distortions: DistortionMap) {
  const descriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'defaultView');
  if (descriptor?.get) {
    distortions.set(descriptor.get, () => {
      return () => {
        return window;
      };
    });
  }

  const documentForbiddenMethods = ['write'];
  for (const method of documentForbiddenMethods) {
    const descriptor = Object.getOwnPropertyDescriptor(Document.prototype, method);
    if (descriptor?.set) {
      distortions.set(descriptor.set, failToSet);
    }
    if (descriptor?.value) {
      distortions.set(descriptor.value, failToSet);
    }
  }
}
