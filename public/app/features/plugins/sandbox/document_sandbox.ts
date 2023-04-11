export function createSandboxDocument(): Document {
  const sandboxDocument = document.implementation.createDocument('http://www.w3.org/1999/xhtml', 'html', null);
  const body = document.createElementNS('http://www.w3.org/1999/xhtml', 'body');
  body.setAttribute('id', 'grafana-plugin-sanbox');
  sandboxDocument.documentElement.appendChild(body);
  const head = document.createElementNS('http://www.w3.org/1999/xhtml', 'head');
  head.setAttribute('id', 'grafana-plugin-sanbox');
  sandboxDocument.documentElement.appendChild(head);
  return sandboxDocument;
}

export function fabricateMockElement(nodeName: string, sandboxDocument: Document): Element {
  switch (nodeName.toLowerCase()) {
    case 'body':
      return sandboxDocument.body;
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
