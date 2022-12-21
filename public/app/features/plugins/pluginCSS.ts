const isWebkit = !!window.navigator.userAgent.match(/AppleWebKit\/([^ ;]*)/);
const bust = '?_cache=' + Date.now();
const waitSeconds = 100;

function webkitLoadCheck(link: any, callback: any) {
  setTimeout(function () {
    for (let i = 0; i < document.styleSheets.length; i++) {
      const sheet = document.styleSheets[i];
      if (sheet.href === link.href) {
        return callback();
      }
    }
    webkitLoadCheck(link, callback);
  }, 10);
}

const noop = function () {};

function loadCSS(url: string) {
  return new Promise(function (resolve, reject) {
    const timeout = setTimeout(function () {
      reject('Unable to load CSS');
    }, waitSeconds * 1000);
    const _callback = function (error?: unknown) {
      clearTimeout(timeout);
      link.onload = link.onerror = noop;
      setTimeout(function () {
        if (error) {
          reject(error);
        } else {
          resolve('');
        }
      }, 7);
    };
    const link = document.createElement('link');
    link.type = 'text/css';
    link.rel = 'stylesheet';
    link.href = url;

    if (!link.href.match('plugin-cdn.')) {
      link.href = link.href + bust;
    }

    if (!isWebkit) {
      link.onload = function () {
        _callback();
      };
    } else {
      webkitLoadCheck(link, _callback);
    }
    link.onerror = function (event) {
      // @ts-ignore
      _callback(event.error || new Error('Error loading CSS file.'));
    };
    document.head.appendChild(link);
  });
}

type SystemJSLoad = {
  address: string;
  metadata: Record<string, any>;
  name: string;
  source: string;
};

/*
  Locate: Overrides the location of the plugin resource
  Plugins that import css use relative paths Systemjs.register. Rather than attempt to resolve it in the pluginCDN
  systemjs plugin we let SystemJS resolve it to origin then we can replace the "baseUrl" in the locate hook.
 */
export function locateCSS(load: SystemJSLoad) {
  if (load.metadata.loader === 'cdn-loader') {
    if (load.address.startsWith(`${location.origin}/public/plugin-cdn`)) {
      load.address = load.address.replace(
        `${location.origin}/public/plugin-cdn`,
        'https://grafana-assets.grafana.net/plugin-cdn-test/plugin-cdn'
      );
    }
  }
  return load.address;
}

export function fetchCSS(load: SystemJSLoad) {
  const links = document.getElementsByTagName('link');
  const linkHrefs: string[] = [];
  for (let i = 0; i < links.length; i++) {
    linkHrefs.push(links[i].href);
  }

  // dont reload styles loaded in the head
  for (let i = 0; i < linkHrefs.length; i++) {
    if (load.address === linkHrefs[i]) {
      return '';
    }
  }
  return loadCSS(load.address);
}
