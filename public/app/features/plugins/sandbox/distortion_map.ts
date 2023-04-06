// do not use directly
const generalDistortionMap = new Map<unknown, unknown>();

export function getGeneralSandboxDistortionMap() {
  if (generalDistortionMap.size === 0) {
    initGeneralDistortionMap();
  }
  return generalDistortionMap;
}

function initGeneralDistortionMap() {
  // Document properties and methods
  const forbiddenDocumentProperties = [
    // 'createElement',
    // 'createElementNS',
    'createTreeWalker',
    'elementFromPoint',
    'elementsFromPoint',
    'adoptNode',
    'importNode',
    'open',
    'close',
    'write',
    'writeln',
    'execCommand',
    'queryCommandEnabled',
    'queryCommandIndeterm',
    'queryCommandState',
    'queryCommandSupported',
    'queryCommandValue',
  ];

  const createElementDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'createElement');
  if (createElementDescriptor?.value) {
    generalDistortionMap.set(createElementDescriptor.value, (tagName: string) => {
      if (typeof tagName !== 'string') {
        throw new Error('document.createElement can only be called with a string');
      }
      if (tagName.toLowerCase() === 'iframe') {
        throw new Error('document.createElement is not allowed to create iframes');
      }
      return createElementDescriptor.value.call(document, tagName);
    });
  }

  for (const property of forbiddenDocumentProperties) {
    const descriptor = Object.getOwnPropertyDescriptor(Document.prototype, property);
    if (!descriptor) {
      continue;
    }
    function fail() {
      throw new Error('document.' + property + ' is not allowed in sandboxed plugins');
    }

    function mock(el: unknown): unknown {
      return el;
    }
    if (descriptor.value) {
      generalDistortionMap.set(descriptor.value, fail);
    }
    if (descriptor.set) {
      generalDistortionMap.set(descriptor.set, mock);
    }
  }

  // Element properties and methods
  const forbiddenElementProperties = [
    'appendChild',
    'insertBefore',
    'replaceChild',
    'removeChild',
    'createElement',
    'createTextNode',
    'cloneNode',
    'setAttribute',
    'removeAttribute',
    'append',
    'prepend',
    'before',
    'after',
    'remove',
    'replaceWith',
    'insertAdjacentElement',
    'insertAdjacentHTML',
    'insertAdjacentText',
    'innerHTML',
    'outerHTML',
    'setHTML',
  ];

  for (const property of forbiddenElementProperties) {
    const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, property);
    function mock(el: unknown): unknown {
      return el;
    }
    if (!descriptor) {
      continue;
    }
    if (descriptor.value) {
      generalDistortionMap.set(descriptor.value, mock);
    }
    if (descriptor.set) {
      generalDistortionMap.set(descriptor.set, mock);
    }
  }

  const windowTop = Object.getOwnPropertyDescriptor(Window.prototype, 'top');
  if (windowTop?.get) {
    generalDistortionMap.set(windowTop.get, () => {
      throw new Error('window.top is not allowed in sandboxed plugins');
    });
  }

  const iframeHtmlForbiddenProperties = ['contentDocument', 'contentWindow', 'src', 'srcdoc', 'srcObject', 'srcset'];

  for (const property of iframeHtmlForbiddenProperties) {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, property);
    if (descriptor) {
      function fail() {
        throw new Error('iframe.' + property + ' is not allowed in sandboxed plugins');
      }
      if (descriptor.value) {
        generalDistortionMap.set(descriptor.value, fail);
      }
      if (descriptor.set) {
        generalDistortionMap.set(descriptor.set, fail);
      }
      if (descriptor.get) {
        generalDistortionMap.set(descriptor.get, fail);
      }
    }
  }
}
