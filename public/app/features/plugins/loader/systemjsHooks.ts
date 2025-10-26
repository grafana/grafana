import { PluginLoadingStrategy } from '@grafana/data';
import { config } from '@grafana/runtime';

import { transformPluginSourceForCDN } from '../cdn/utils';

import { LOAD_PLUGIN_CSS_REGEX, JS_CONTENT_TYPE_REGEX, SHARED_DEPENDENCY_PREFIX } from './constants';
import { getPluginInfoFromCache, resolvePluginUrlWithCache } from './pluginInfoCache';
// SystemJS has to be imported before the sharedDependenciesMap
import { SystemJS } from './systemjs';
// eslint-disable-next-line import/order
import { sharedDependenciesMap } from './sharedDependencies';
import { SystemJSWithLoaderHooks } from './types';
import { buildImportMap, isHostedOnCDN } from './utils';

export function initSystemJSHooks() {
  const imports = buildImportMap(sharedDependenciesMap);

  SystemJS.addImportMap({ imports });

  const systemJSPrototype: SystemJSWithLoaderHooks = SystemJS.constructor.prototype;

  // This instructs SystemJS to load plugin assets using fetch and eval if it returns a truthy value, otherwise
  // it will load the plugin using a script tag. The logic that sets loadingStrategy comes from the backend.
  // See: pkg/services/pluginsintegration/pluginassets/pluginassets.go
  systemJSPrototype.shouldFetch = function (url) {
    const pluginInfo = getPluginInfoFromCache(url);
    const jsTypeRegEx = /^[^#?]+\.(js)([?#].*)?$/;

    if (!jsTypeRegEx.test(url)) {
      return true;
    }

    return Boolean(pluginInfo?.loadingStrategy !== PluginLoadingStrategy.script);
  };

  const originalImport = systemJSPrototype.import;
  // Hook Systemjs import to support plugins that only have a default export.
  systemJSPrototype.import = function (...args: Parameters<typeof originalImport>) {
    return originalImport.apply(this, args).then((module) => {
      if (module && module.__useDefault) {
        return module.default;
      }
      return module;
    });
  };

  const systemJSFetch = systemJSPrototype.fetch;
  systemJSPrototype.fetch = function (url: string, options?: Record<string, unknown>) {
    return decorateSystemJSFetch(systemJSFetch, url, options);
  };

  const systemJSResolve = systemJSPrototype.resolve;
  systemJSPrototype.resolve = decorateSystemJSResolve.bind(systemJSPrototype, systemJSResolve);

  // Older plugins load .css files which resolves to a CSS Module.
  // https://github.com/WICG/webcomponents/blob/gh-pages/proposals/css-modules-v1-explainer.md#importing-a-css-module
  // Any css files loaded via SystemJS have their styles applied onload.
  systemJSPrototype.onload = decorateSystemJsOnload;
}

export async function decorateSystemJSFetch(
  systemJSFetch: SystemJSWithLoaderHooks['fetch'],
  url: string,
  options?: Record<string, unknown>
) {
  const res = await systemJSFetch(url, options);
  const contentType = res.headers.get('content-type') || '';

  if (JS_CONTENT_TYPE_REGEX.test(contentType)) {
    const source = await res.text();
    let transformedSrc = source;

    // JS files on the CDN need their asset paths transformed in the source
    if (isHostedOnCDN(res.url)) {
      const cdnTransformedSrc = transformPluginSourceForCDN({ url: res.url, source: transformedSrc });
      return new Response(new Blob([cdnTransformedSrc], { type: 'text/javascript' }));
    }

    return new Response(new Blob([transformedSrc], { type: 'text/javascript' }));
  }
  return res;
}

export function decorateSystemJSResolve(
  this: SystemJSWithLoaderHooks,
  originalResolve: SystemJSWithLoaderHooks['resolve'],
  id: string,
  parentUrl?: string
) {
  try {
    const url = originalResolve.apply(this, [id, parentUrl]);
    const cleanedUrl = getBackWardsCompatibleUrl(url);
    const isFileSystemModule =
      (cleanedUrl.endsWith('.js') || cleanedUrl.endsWith('.css')) && !isHostedOnCDN(cleanedUrl);
    // Add a cache query param for filesystem module.js requests
    // CDN hosted plugins contain the version in the path so skip
    return isFileSystemModule ? resolvePluginUrlWithCache(cleanedUrl) : cleanedUrl;
  } catch (err) {
    // Provide fallback for plugins that use `loadPluginCss` to load theme styles.
    if (LOAD_PLUGIN_CSS_REGEX.test(id)) {
      const resolvedUrl = getLoadPluginCssUrl(id);
      const url = originalResolve.apply(this, [resolvedUrl, parentUrl]);
      return resolvePluginUrlWithCache(url);
    }
    console.warn(`SystemJS: failed to resolve '${id}'`);
    return id;
  }
}

export function decorateSystemJsOnload(err: unknown, id: string) {
  // IF the url is relative resolve to current origin, absolute urls passed in will ignore base.
  const url = new URL(id, window.location.origin);
  if (url.pathname.endsWith('.css') && !err) {
    const module = SystemJS.get(id);
    const styles = module?.default;
    if (styles) {
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, styles];
    }
  }
}

// This function handles the following legacy SystemJS functionality:
// - strips legacy loader wildcard from urls
// - support config.defaultExtension for System.register deps that lack an extension (e.g. './my_ctrl')
function getBackWardsCompatibleUrl(url: string) {
  if (url.startsWith(`${SHARED_DEPENDENCY_PREFIX}:`)) {
    return url;
  }
  if (url.endsWith('!')) {
    url = url.slice(0, -1);
  }
  const systemJSFileExtensions = ['css', 'js', 'json', 'wasm'];
  const hasValidFileExtension = systemJSFileExtensions.some((extensionName) => url.endsWith(extensionName));

  return hasValidFileExtension ? url : url + '.js';
}

// This function takes the path used in loadPluginCss and attempts to resolve it
// by checking the SystemJS entries for a matching pluginId then using that entry to find the baseUrl.
// If no match is found then it returns a fallback attempt at a relative path.
export function getLoadPluginCssUrl(id: string) {
  const pluginId = id.split('/')[1];
  let url = '';
  for (const [moduleId] of SystemJS.entries()) {
    if (moduleId.includes(pluginId)) {
      url = moduleId;
      break;
    }
  }

  const index = url.lastIndexOf('/plugins');
  if (index === -1) {
    return `${config.appSubUrl ?? ''}/public/${id}`;
  }
  const baseUrl = url.substring(0, index);
  return `${baseUrl}/${id}`;
}
