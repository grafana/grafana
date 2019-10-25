const waitSeconds = 100;
const head = document.getElementsByTagName('head')[0];

// get all link tags in the page
const links = document.getElementsByTagName('link');
const linkHrefs: string[] = [];
for (let i = 0; i < links.length; i++) {
  linkHrefs.push(links[i].href);
}

const isWebkit = !!window.navigator.userAgent.match(/AppleWebKit\/([^ ;]*)/);
const webkitLoadCheck = (link: HTMLLinkElement, callback: Function) => {
  setTimeout(() => {
    for (let i = 0; i < document.styleSheets.length; i++) {
      const sheet = document.styleSheets[i];
      if (sheet.href === link.href) {
        return callback();
      }
    }
    webkitLoadCheck(link, callback);
  }, 10);
};

const noop = () => {};

const loadCSS = (url: string) => {
  return new Promise((resolve, reject) => {
    const link = document.createElement('link');
    const timeout = setTimeout(() => {
      reject('Unable to load CSS');
    }, waitSeconds * 1000);

    const _callback = (error: any) => {
      clearTimeout(timeout);
      link.onload = link.onerror = noop;
      setTimeout(() => {
        if (error) {
          reject(error);
        } else {
          resolve('');
        }
      }, 7);
    };

    link.type = 'text/css';
    link.rel = 'stylesheet';
    link.href = url;

    if (!isWebkit) {
      link.onload = () => {
        _callback(undefined);
      };
    } else {
      webkitLoadCheck(link, _callback);
    }

    link.onerror = (evt: any) => {
      _callback(evt.error || new Error('Error loading CSS file.'));
    };

    head.appendChild(link);
  });
};

export function fetch(load: any): any {
  if (typeof window === 'undefined') {
    return '';
  }

  // don't reload styles loaded in the head
  for (let i = 0; i < linkHrefs.length; i++) {
    if (load.address === linkHrefs[i]) {
      return '';
    }
  }
  return loadCSS(load.address);
}
