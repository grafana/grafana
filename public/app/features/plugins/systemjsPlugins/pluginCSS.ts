import { noop } from 'lodash';

import { config } from '@grafana/runtime';

import type { SystemJSLoad } from './types';

/*
  Locate: Overrides the location of the plugin resource
  Plugins that import css use relative paths in Systemjs.register dependency list.
  Rather than attempt to resolve it in the pluginCDN systemjs plugin let SystemJS resolve it to origin
  then we can replace the "baseUrl" with the "cdnHost".
 */
export function locateCSS(load: SystemJSLoad) {
  if (load.metadata.loader === 'cdn-loader' && load.address.startsWith(`${location.origin}/public/plugin-cdn`)) {
    load.address = load.address.replace(`${location.origin}/public/plugin-cdn`, config.pluginsCDNBaseURL);
  }
  return load.address;
}

/*
  Fetch: Called with second argument representing default fetch function, has full control of fetch output.
  Plugins that have external CSS will use this plugin to load their custom styles
*/
export function fetchCSS(load: SystemJSLoad) {
  const links = document.getElementsByTagName('link');
  const linkHrefs: string[] = Array.from(links).map((link) => link.href);

  // dont reload styles loaded in the head
  if (linkHrefs.includes(load.address)) {
    return '';
  }

  return loadCSS(load.address);
}

const bust = '?_cache=' + Date.now();
const waitSeconds = 100;

function loadCSS(url: string) {
  return new Promise(function (resolve, reject) {
    const timeout = setTimeout(function () {
      reject('Unable to load CSS');
    }, waitSeconds * 1000);
    const _callback = function (error?: string | Error) {
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

    // Don't cache bust plugins loaded from cdn.
    if (!link.href.startsWith(config.pluginsCDNBaseURL)) {
      link.href = link.href + bust;
    }

    link.onload = function () {
      _callback();
    };

    link.onerror = function (event) {
      _callback(event instanceof ErrorEvent ? event.message : new Error('Error loading CSS file.'));
    };

    document.head.appendChild(link);
  });
}
