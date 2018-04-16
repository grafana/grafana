var waitSeconds = 100;
var head = document.getElementsByTagName('head')[0];

// get all link tags in the page
var links = document.getElementsByTagName('link');
var linkHrefs = [];
for (var i = 0; i < links.length; i++) {
  linkHrefs.push(links[i].href);
}

var isWebkit = !!window.navigator.userAgent.match(/AppleWebKit\/([^ ;]*)/);
var webkitLoadCheck = function(link, callback) {
  setTimeout(function() {
    for (var i = 0; i < document.styleSheets.length; i++) {
      var sheet = document.styleSheets[i];
      if (sheet.href === link.href) {
        return callback();
      }
    }
    webkitLoadCheck(link, callback);
  }, 10);
};

var noop = function() {};

var loadCSS = function(url) {
  return new Promise(function(resolve, reject) {
    var link = document.createElement('link');
    var timeout = setTimeout(function() {
      reject('Unable to load CSS');
    }, waitSeconds * 1000);

    var _callback = function(error) {
      clearTimeout(timeout);
      link.onload = link.onerror = noop;
      setTimeout(function() {
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
      link.onload = function() {
        _callback(undefined);
      };
    } else {
      webkitLoadCheck(link, _callback);
    }

    link.onerror = function(evt: any) {
      _callback(evt.error || new Error('Error loading CSS file.'));
    };

    head.appendChild(link);
  });
};

export function fetch(load): any {
  if (typeof window === 'undefined') {
    return '';
  }

  // don't reload styles loaded in the head
  for (var i = 0; i < linkHrefs.length; i++) {
    if (load.address === linkHrefs[i]) {
      return '';
    }
  }
  return loadCSS(load.address);
}
