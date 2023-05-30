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

export function isDomElementInsideSandbox(el: Element): boolean {
  return el.closest(`[data-plugin-sandbox]`) !== null;
}

let sandboxBody: HTMLDivElement;

export function getSandboxMockBody(): Element {
  if (!sandboxBody) {
    sandboxBody = document.createElement('div');
    sandboxBody.setAttribute('id', 'grafana-plugin-sandbox-body');
    sandboxBody.dataset.sandbox = 'sandboxed-plugin';

    sandboxBody.style.width = '100%';
    sandboxBody.style.height = '0%';
    sandboxBody.style.overflow = 'hidden';
    // sandboxBody.style.position = 'absolute';
    sandboxBody.style.top = '0';
    sandboxBody.style.left = '0';
    // todo re-evalute this
    // sandboxBody.style.zIndex = '9999';
    document.body.appendChild(sandboxBody);
  }
  return sandboxBody;
}
