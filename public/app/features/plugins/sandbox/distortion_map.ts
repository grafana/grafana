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

type DistortionMap = Map<unknown, (originalAttrOrMethod: unknown) => unknown>;
const generalDistortionMap: DistortionMap = new Map();

export function getGeneralSandboxDistortionMap() {
  if (generalDistortionMap.size === 0) {
    // initialize the distortion map
    distortIframeAttributes(generalDistortionMap);
    distortConsole(generalDistortionMap);
    distortAlert(generalDistortionMap);
    distortAppend(generalDistortionMap);
  }
  return generalDistortionMap;
}

function failToSet() {
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
      function fail() {
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
    function sandboxLog(...args: unknown[]) {
      console.log(`[plugin]`, ...args);
    }
    const sandboxConsole = {
      log: sandboxLog,
      warn: sandboxLog,
      error: sandboxLog,
      info: sandboxLog,
      debug: sandboxLog,
      table: sandboxLog,
    };

    function getSandboxConsole() {
      return sandboxConsole;
    }

    distortions.set(descriptor.value, getSandboxConsole);
  }
  if (descriptor?.set) {
    distortions.set(descriptor.set, failToSet);
  }
}

// set distortions to alert to always output to the console
function distortAlert(distortions: DistortionMap) {
  const descriptor = Object.getOwnPropertyDescriptor(window, 'alert');
  if (descriptor?.value) {
    function sandboxAlert(...args: unknown[]) {
      console.log(`[plugin]`, ...args);
    }
    distortions.set(descriptor.value, sandboxAlert);
  }
  if (descriptor?.set) {
    distortions.set(descriptor.set, failToSet);
  }
}

function isFunction(value: unknown): value is Function {
  return typeof value === 'function';
}

// set distortions to append elements to the document
// we allow style tags to appended
function distortAppend(distortions: DistortionMap) {
  const appendDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'append');
  const appendChildDescriptor = Object.getOwnPropertyDescriptor(Node.prototype, 'appendChild');

  function getAppendDistortion(originalMethod: unknown) {
    return function appendDistortion(this: HTMLElement, ...args: Node[]) {
      for (const arg of args) {
        // allow style tags to append to the original document
        if (arg.nodeName.toLowerCase() === 'style') {
          document.head.appendChild(arg);
          continue;
        }
        // always true. append is a method. This is to please typescript
        if (isFunction(originalMethod)) {
          console.log(this);
          console.log(originalMethod);
          console.log(args);
          originalMethod.apply(this, args);
          continue;
        }
      }
    };
  }

  if (appendDescriptor?.value) {
    distortions.set(appendDescriptor.value, getAppendDistortion);
  }
  if (appendChildDescriptor?.value) {
    distortions.set(appendChildDescriptor.value, getAppendDistortion);
  }
}
