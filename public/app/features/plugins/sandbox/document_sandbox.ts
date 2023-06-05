import { forbiddenElements } from './constants';

export const SANDBOX_LIVE_VALUE = Symbol.for('@@SANDBOX_LIVE_VALUE');

export function getSafeSandboxDomElement(element: Element): Element {
  const nodeName = Reflect.get(element, 'nodeName');

  // we don't allow plugins to get the document.body directly. They get a sandboxed version.
  // the condition redundancy is intentional
  if (nodeName === 'body' || element === document.body) {
    return getSandboxMockBody();
  }

  // allow acces to the head
  // the condition redundancy is intentional
  if (nodeName === 'head' || element === document.head) {
    return element;
  }

  // allow access to the HTML element
  if (element === document.documentElement) {
    return element;
  }

  if (forbiddenElements.includes(nodeName)) {
    throw new Error('<' + nodeName + '> is not allowed in sandboxed plugins');
  }

  // allow elements inside the sandbox or the sandbox body
  if (isDomElementInsideSandbox(element)) {
    return element;
  }

  const mockElement = document.createElement(nodeName);
  mockElement.setAttribute('id', 'grafana-plugin-sandbox');
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
 * Mark an element as a live target inside the sandbox
 * A "live target" is an object which attributes can be observed
 * and modified directly inside the sandbox
 *
 * This is necessary for some specific cases such as modifying the style atribute of an element
 */
export function markDomElementStyleAsALiveTarget(el: Element, mark: symbol) {
  if (
    // only HTMLElement's (extends Element) have a style attribute
    el instanceof HTMLElement &&
    // do not define it twice
    //@ts-ignore - our types are out of date
    !Object.hasOwn(el.style, mark)
  ) {
    Reflect.defineProperty(el.style, mark, {});
  }
}

/*
 * An element is considered to be inside the sandbox if:
 * - is not part of the document (detached)
 * - is inside a div[data-plugin-sandbox]
 *
 */
export function isDomElementInsideSandbox(el: Element): boolean {
  return !document.contains(el) || el.closest(`[data-plugin-sandbox]`) !== null;
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
