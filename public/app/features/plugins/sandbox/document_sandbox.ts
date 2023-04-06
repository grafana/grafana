export function createSandboxDocument(): Document {
  const sandboxDocument = document.implementation.createDocument('http://www.w3.org/1999/xhtml', 'html', null);
  const body = document.createElementNS('http://www.w3.org/1999/xhtml', 'body');
  body.setAttribute('id', 'grafana-plugin-sanbox');
  sandboxDocument.documentElement.appendChild(body);
  return sandboxDocument;
}
