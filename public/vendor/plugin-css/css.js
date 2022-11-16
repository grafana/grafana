"use strict";

if (typeof window !== 'undefined') {
  var bust = '?_cache=' + Date.now();
  var waitSeconds = 100;

  var head = document.getElementsByTagName('head')[0];

  // get all link tags in the page
  var links = document.getElementsByTagName('link');
  var linkHrefs = [];
  for (var i = 0; i < links.length; i++) {
    linkHrefs.push(links[i].href);
  }

  var isWebkit = !!window.navigator.userAgent.match(/AppleWebKit\/([^ ;]*)/);
  var webkitLoadCheck = function (link, callback) {
    setTimeout(function () {
      for (var i = 0; i < document.styleSheets.length; i++) {
        var sheet = document.styleSheets[i];
        if (sheet.href === link.href) {
          return callback();
        }
      }
      webkitLoadCheck(link, callback);
    }, 10);
  };

  var noop = function () { };

  var loadCSS = function (url) {
    return new Promise(function (resolve, reject) {
      var timeout = setTimeout(function () {
        reject('Unable to load CSS');
      }, waitSeconds * 1000);
      var _callback = function (error) {
        clearTimeout(timeout);
        link.onload = link.onerror = noop;
        setTimeout(function () {
          if (error) {
            reject(error);
          }
          else {
            resolve('');
          }
        }, 7);
      };
      var link = document.createElement('link');
      link.type = 'text/css';
      link.rel = 'stylesheet';
      link.href = url;
      // YOLO Plugin CDN FTW 🤘
      if (!link.href.match('plugin-cdn.')) {
        link.href = link.href + bust;
      }
      if (!isWebkit) {
        link.onload = function () {
          _callback();
        }
      } else {
        webkitLoadCheck(link, _callback);
      }
      link.onerror = function (event) {
        _callback(event.error || new Error('Error loading CSS file.'));
      };
      head.appendChild(link);
    });
  };

  exports.fetch = function (load) {
    // dont reload styles loaded in the head
    for (var i = 0; i < linkHrefs.length; i++)
      if (load.address == linkHrefs[i])
        return '';
    return loadCSS(load.address);
  };

  // ⚠️ Plugin CDN PoC stuff ⚠️
  // imported css creates relative css paths in Systemjs.register which are troublesome to transform in pluginCDN
  // systemjs plugin. Prefer to let systemjs resolve to localhost then replace in locate hook.
  exports.locate = function (load) {
    if (load.metadata.loader === 'cdn-loader') {
      if (load.address.startsWith('http://localhost:3000/public/plugin-cdn')) {
        load.address = load.address.replace('http://localhost:3000/public/plugin-cdn', 'https://plugin-cdn.storage.googleapis.com');
      }
    }
    return load.address;
  }
}
