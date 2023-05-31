type DistortionMap = Map<unknown, unknown>;
const generalDistortionMap: DistortionMap = new Map();

function failToSet() {
  throw new Error('Plugins are not allowed to set sandboxed properties');
}

// sets distortion to protect iframe elements
function distortIframeAttributes(distortions: DistortionMap) {
  const iframeHtmlForbiddenProperties = ['contentDocument', 'contentWindow', 'src', 'srcdoc', 'srcObject', 'srcset'];

  for (const property of iframeHtmlForbiddenProperties) {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, property);
    if (descriptor) {
      function fail() {
        throw new Error('iframe.' + property + ' is not allowed in sandboxed plugins');
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

function distortConsole(distortions: DistortionMap) {
  // distorts window.console to prefix it
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
    };

    distortions.set(descriptor.value, sandboxConsole);
  }
  if (descriptor?.set) {
    distortions.set(descriptor.set, failToSet);
  }
}

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

export function getGeneralSandboxDistortionMap() {
  if (generalDistortionMap.size === 0) {
    distortIframeAttributes(generalDistortionMap);
    distortConsole(generalDistortionMap);
    distortAlert(generalDistortionMap);
  }
  return generalDistortionMap;
}
