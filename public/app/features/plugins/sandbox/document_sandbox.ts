export function getSandboxDocument(pluginId: string): Document {
  const newDoc = new DOMParser().parseFromString(
    `<!DOCTYPE html>
        <html>
          <head id="grafana-plugin-sandbox-${pluginId}"></head>
          <body id="grafana-plugin-sandbox-${pluginId}"></body></body>
        </html>`,
    'text/html'
  );
  return newDoc;
}

export const SANDBOX_LIVE_VALUE = Symbol.for('@@SANDBOX_LIVE_VALUE');

export function fabricateMockElement(nodeName: string, sandboxDocument: Document): Element {
  switch (nodeName.toLowerCase()) {
    case 'body':
      return getSandboxMockBody();
    case 'head':
      return sandboxDocument.head;
    case 'html':
      return sandboxDocument.documentElement;
  }
  const element = sandboxDocument.createElement(nodeName.toLowerCase());
  element.setAttribute('id', 'grafana-plugin-sandbox');
  return element;
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
export function markDomElementAsALiveTarget(el: Element, mark: symbol) {
  if (
    el instanceof HTMLElement &&
    // isDomElementInsideSandbox(el) &&
    //@ts-ignore
    !Object.hasOwn(el.style, mark)
  ) {
    Reflect.defineProperty(el.style, mark, {});
  }
}

/*
 * An element is considered to be inside the sandbox if:
 * - is not part of the document
 * - is inside a div[data-plugin-sandbox]
 *
 */
export function isDomElementInsideSandbox(el: Element): boolean {
  return document.contains(el) && el.closest(`[data-plugin-sandbox]`) !== null;
}

let sandboxBody: HTMLDivElement;

export function getSandboxMockBody(): Element {
  if (!sandboxBody) {
    sandboxBody = document.createElement('div');
    sandboxBody.setAttribute('id', 'grafana-plugin-sandbox-body');
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
