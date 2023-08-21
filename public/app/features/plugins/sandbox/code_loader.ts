import { PluginMeta } from '@grafana/data';

import { getPluginCdnResourceUrl, extractPluginIdVersionFromUrl, transformPluginSourceForCDN } from '../cdn/utils';
import { PLUGIN_CDN_URL_KEY } from '../constants';

import { SandboxEnvironment } from './types';

function isSameDomainAsHost(url: string): boolean {
  const locationUrl = new URL(window.location.href);
  const paramUrl = new URL(url);
  return locationUrl.host === paramUrl.host;
}

export async function loadScriptIntoSandbox(url: string, meta: PluginMeta, sandboxEnv: SandboxEnvironment) {
  let scriptCode = '';

  // same-domain
  if (isSameDomainAsHost(url)) {
    const response = await fetch(url);
    scriptCode = await response.text();
    scriptCode = patchPluginSourceMap(meta, scriptCode);

    // cdn loaded
  } else if (url.includes(PLUGIN_CDN_URL_KEY)) {
    const response = await fetch(url);
    scriptCode = await response.text();
    const pluginUrl = getPluginCdnResourceUrl(`/public/${meta.module}`) + '.js';
    const { version } = extractPluginIdVersionFromUrl(pluginUrl);
    scriptCode = transformPluginSourceForCDN({
      pluginId: meta.id,
      version,
      source: scriptCode,
    });
  }

  if (scriptCode.length === 0) {
    throw new Error('Only same domain scripts are allowed in sandboxed plugins');
  }

  sandboxEnv.evaluate(scriptCode);
}

export async function getPluginCode(meta: PluginMeta): Promise<string> {
  if (meta.module.includes(`${PLUGIN_CDN_URL_KEY}/`)) {
    // should load plugin from a CDN
    const pluginUrl = getPluginCdnResourceUrl(`/public/${meta.module}`) + '.js';
    const response = await fetch(pluginUrl);
    let pluginCode = await response.text();
    const { version } = extractPluginIdVersionFromUrl(pluginUrl);
    pluginCode = transformPluginSourceForCDN({
      pluginId: meta.id,
      version,
      source: pluginCode,
    });
    return pluginCode;
  } else {
    //local plugin loading
    const response = await fetch('public/' + meta.module + '.js');
    let pluginCode = await response.text();
    pluginCode = patchPluginSourceMap(meta, pluginCode);
    pluginCode = patchPluginAPIs(pluginCode);
    return pluginCode;
  }
}

function patchPluginAPIs(pluginCode: string): string {
  return pluginCode.replace(/window\.location/gi, 'window.locationSandbox');
}

/**
 * Patches the plugin's module.js source code references to sourcemaps to include the full url
 * of the module.js file instead of the regular relative reference.
 *
 * Because the plugin module.js code is loaded via fetch and then "eval" as a string
 * it can't find the references to the module.js.map directly and we need to patch it
 * to point to the correct location
 */
function patchPluginSourceMap(meta: PluginMeta, pluginCode: string): string {
  // skips inlined and files without source maps
  if (pluginCode.includes('//# sourceMappingURL=module.js.map')) {
    let replaceWith = '';
    // make sure we don't add the sourceURL twice
    if (!pluginCode.includes('//# sourceURL') || !pluginCode.includes('//@ sourceUrl')) {
      replaceWith += `//# sourceURL=module.js\n`;
    }
    // modify the source map url to point to the correct location
    const sourceCodeMapUrl = `/public/${meta.module}.js.map`;
    replaceWith += `//# sourceMappingURL=${sourceCodeMapUrl}`;

    return pluginCode.replace('//# sourceMappingURL=module.js.map', replaceWith);
  }
  return pluginCode;
}
