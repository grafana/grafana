import { isNearMembraneProxy, ProxyTarget } from '@locker/near-membrane-shared';
import { cloneDeep } from 'lodash';
import Prism from 'prismjs';

import { CustomVariableSupport, DataSourceApi } from '@grafana/data';

import { forbiddenElements } from './constants';
import { isReactClassComponent, logWarning, unboxNearMembraneProxies } from './utils';

// IMPORTANT: NEVER export this symbol from a public (e.g `@grafana/*`) package
const SANDBOX_LIVE_VALUE = Symbol.for('@@SANDBOX_LIVE_VALUE');

export function getSafeSandboxDomElement(element: Element, pluginId: string): Element {
  const nodeName = Reflect.get(element, 'nodeName');

  // the condition redundancy is intentional
  if (nodeName === 'body' || element === document.body) {
    return document.body;
  }

  // allow access to the head
  // the condition redundancy is intentional
  if (nodeName === 'head' || element === document.head) {
    return element;
  }

  // allow access to the HTML element
  if (element === document.documentElement) {
    return element;
  }

  if (forbiddenElements.includes(nodeName)) {
    logWarning('<' + nodeName + '> is not allowed in sandboxed plugins', {
      pluginId,
      param: nodeName,
    });

    throw new Error('<' + nodeName + '> is not allowed in sandboxed plugins');
  }

  // allow elements inside the sandbox or the sandbox body
  if (isDomElementInsideSandbox(element, pluginId)) {
    return element;
  }

  if (element.parentNode === document.body || element.closest('#reactRoot') === null) {
    return element;
  }

  // any other element gets a mock
  const mockElement = document.createElement(nodeName);
  mockElement.dataset.grafanaPluginSandboxElement = 'true';
  // we are not logging this because a high number of warnings can be generated
  return mockElement;
}

export function isDomElement(obj: unknown): obj is Element {
  if (typeof obj === 'object' && obj instanceof Element) {
    try {
      return obj.nodeName !== undefined;
    } catch (e) {
      return false;
    }
  }
  return false;
}

/**
 * Mark an element style attribute as a live target inside the sandbox
 * A "live target" is an object which attributes can be observed
 * and modified directly inside the sandbox
 *
 * This is necessary for plugins working with style attributes to work in Chrome
 */
export function markDomElementStyleAsALiveTarget(el: Element) {
  const style = Reflect.get(el, 'style');
  if (!Object.hasOwn(style, SANDBOX_LIVE_VALUE)) {
    Reflect.defineProperty(style, SANDBOX_LIVE_VALUE, {});
  }
}

export function recursivePatchObjectAsLiveTarget(obj: unknown) {
  if (!obj) {
    return;
  }
  if (Array.isArray(obj)) {
    obj.forEach(recursivePatchObjectAsLiveTarget);
    unconditionallyPatchObjectAsLiveTarget(obj);
  } else if (typeof obj === 'object') {
    Object.values(obj).forEach(recursivePatchObjectAsLiveTarget);
    unconditionallyPatchObjectAsLiveTarget(obj);
  }
}

function unconditionallyPatchObjectAsLiveTarget(obj: unknown) {
  if (!obj) {
    return;
  }
  // do not patch it twice
  if (Object.hasOwn(obj, SANDBOX_LIVE_VALUE)) {
    return obj;
  }

  Reflect.defineProperty(obj, SANDBOX_LIVE_VALUE, {});
  return obj;
}

/**
 * Some specific near membrane proxies interfere with plugins
 * an example of this is React class components state and their fast life cycles
 * with cached objects.
 *
 * This function marks an object as a live target inside the sandbox
 * but not all objects, only the ones that are allowed to be modified
 */
export function patchObjectAsLiveTarget(obj: unknown) {
  if (!obj) {
    return;
  }

  // do not patch it twice
  if (Object.hasOwn(obj, SANDBOX_LIVE_VALUE)) {
    return;
  }

  if (
    // only for proxies
    isNearMembraneProxy(obj) &&
    // do not patch functions
    !(obj instanceof Function) &&
    // conditions for allowed objects
    // react class components
    (isReactClassComponent(obj) || obj instanceof DataSourceApi || obj instanceof CustomVariableSupport)
  ) {
    Reflect.defineProperty(obj, SANDBOX_LIVE_VALUE, {});
  } else {
    // prismjs languages are defined by directly modifying the prism.languages objects.
    // Plugins inside the sandbox can't modify objects from the blue realm and prismjs.languages
    // is one of them.
    // Marking it as a live target allows plugins inside the sandbox to modify the object directly
    // and make syntax work again.
    if (obj === Prism.languages) {
      Object.defineProperty(obj, SANDBOX_LIVE_VALUE, {});
    }
  }
}

export function isLiveTarget(el: ProxyTarget) {
  return Object.hasOwn(el, SANDBOX_LIVE_VALUE);
}

/*
 * An element is considered to be inside the sandbox if:
 * - is not part of the document (detached)
 * - is inside a div[data-plugin-sandbox]
 *
 */
export function isDomElementInsideSandbox(el: Element, pluginId: string): boolean {
  return !document.contains(el) || el.closest(`[data-plugin-sandbox=${pluginId}]`) !== null;
}

let sandboxBody: HTMLDivElement;

export function getSandboxMockBody(): Element {
  if (!sandboxBody) {
    sandboxBody = document.createElement('div');
    sandboxBody.setAttribute('id', 'grafana-plugin-sandbox-body');

    // the following dataset redundancy is intentional
    sandboxBody.setAttribute('data-plugin-sandbox', 'true');
    sandboxBody.dataset.pluginSandbox = 'sandboxed-plugin';

    sandboxBody.style.width = '100%';
    sandboxBody.style.height = '0%';
    sandboxBody.style.overflow = 'hidden';
    sandboxBody.style.top = '0';
    sandboxBody.style.left = '0';
    document.body.appendChild(sandboxBody);
  }
  return sandboxBody;
}

let nativeAPIsPatched = false;

export function patchWebAPIs() {
  if (!nativeAPIsPatched) {
    nativeAPIsPatched = true;
    patchHistoryReplaceState();
    patchWorkerPostMessage();
  }
}

/*
 *
 * Worker.postMessage uses internally structureClone which won't work with proxies.
 *
 * In case where the blue realm code is directly handling proxy objects that
 * should be send over a post message the blue realm will call postMessage and try to
 * send the proxy resulting in an error.
 *
 * This makes sure all proxies are unboxed before being sent over the post message
 */
function patchWorkerPostMessage() {
  const originalPostMessage = Worker.prototype.postMessage;
  Object.defineProperty(Worker.prototype, 'postMessage', {
    value: function (...args: Parameters<typeof Worker.prototype.postMessage>) {
      // eslint-disable-next-line
      return originalPostMessage.apply(this, unboxNearMembraneProxies(args) as typeof args);
    },
  });
}

/*
 * window.history.replaceState is a native API that won't work with proxies
 * so we need to patch it to unwrap any possible proxies you pass to it.
 *
 * Why can't we directly distord window.history.replaceState calls inside plugins?
 *
 * We can. Except that plugins don't call window.history.replaceState directly they
 * instead use the history object from react-router.
 *
 * react-router is a runtime dependency and it is executed in the blue realm
 * and calls window.history.replaceState directly where the sandbox is not involved at all
 *
 * It is most likely this "original" function is not really the native function because
 * `useLocation` from `react-use` patches this function before the sandbox kicks in.
 *
 * Regarding the performance impact of this cloneDeep. The structures passed to history.replaceState
 * are minimalistic and its impact will be neglegible.
 */
function patchHistoryReplaceState() {
  const original = window.history.replaceState;
  Object.defineProperty(window.history, 'replaceState', {
    value: function (...args: Parameters<typeof window.history.replaceState>) {
      let newArgs = args;
      try {
        newArgs = cloneDeep(args);
      } catch (e) {
        logWarning('Error cloning args in window.history.replaceState', {
          error: String(e),
        });
      }
      return Reflect.apply(original, this, newArgs);
    },
    writable: true,
    configurable: true,
    enumerable: false,
  });
}
