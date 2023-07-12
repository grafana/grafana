import { config, SystemJS } from '@grafana/runtime';

import { transformPluginSourceForCDN } from '../cdn/utils';

import { resolveWithCache } from './cache';
import {
  LOAD_PLUGIN_CSS_REGEX,
  JS_CONTENT_TYPE_REGEX,
  IS_SYSTEM_MODULE_REGEX,
  SHARED_DEPENDENCY_PREFIX,
  ENDS_WITH_FILE_EXTENSION_REGEX,
} from './constants';
import { SystemJSWithLoaderHooks } from './types';

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
    if (!IS_SYSTEM_MODULE_REGEX.test(transformedSrc)) {
      transformedSrc = preventAMDLoaderCollision(source);
    }

    // JS files on the CDN need their asset paths transformed in the source
    if (res.url.startsWith(config.pluginsCDNBaseURL)) {
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
  const isHostedAtCDN = Boolean(config.pluginsCDNBaseURL) && id.startsWith(config.pluginsCDNBaseURL);
  try {
    const url = originalResolve.apply(this, [id, parentUrl]);
    const cleanedUrl = getBackWardsCompatibleUrl(url);
    // Add a cache query param for filesystem module.js requests
    // CDN hosted plugins contain the version in the path so skip
    const shouldAddCacheQueryParam = cleanedUrl.endsWith('module.js') && !isHostedAtCDN;

    return shouldAddCacheQueryParam ? resolveWithCache(cleanedUrl) : cleanedUrl;
  } catch (err) {
    // Provide fallback for old plugins that use `loadPluginCss` to load theme styles
    if (LOAD_PLUGIN_CSS_REGEX.test(id)) {
      return `/public/${id}`;
    }
    console.log(`SystemJS: failed to resolve '${id}'`);
    return id;
  }
}

export function decorateSystemJsOnload(err: unknown, id: string) {
  if (id.endsWith('.css') && !err) {
    const module = SystemJS.get(id);
    const styles = module?.default;
    if (styles) {
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, styles];
    }
  }
}

// This function handles the following legacy SystemJS functionality:
// - strips legacy loader wildcard from urls
// - prepends `SHARED_DEPENDENCY_PREFIX` to correctly resolve `app` imports in old angular plugins
// - support config.defaultExtension for System.register deps that lack an extension (e.g. './my_ctrl')
function getBackWardsCompatibleUrl(url: string) {
  if (url.endsWith('!')) {
    url = url.slice(0, -1);
  }
  const shouldAddDefaultExtension =
    !url.startsWith(`${SHARED_DEPENDENCY_PREFIX}:`) && !ENDS_WITH_FILE_EXTENSION_REGEX.test(url);

  return shouldAddDefaultExtension ? url + '.js' : url;
}

// This transform prevents a conflict between systemjs and requirejs which Monaco Editor
// depends on. See packages/grafana-runtime/src/utils/plugin.ts for more.
function preventAMDLoaderCollision(source: string) {
  return `(function(define) {
  ${source}
})(window.__grafana_amd_define);`;
}
