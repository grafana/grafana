import { PluginMeta, patchArrayVectorProrotypeMethods } from '@grafana/data';

import { transformPluginSourceForCDN } from '../cdn/utils';
import { resolveWithCache } from '../loader/cache';
import { isHostedOnCDN, resolveModulePath } from '../loader/utils';

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
    //even though this is not loaded via a CDN we need to transform the sourceMapUrl
    scriptCode = transformPluginSourceForCDN({
      url,
      source: scriptCode,
      transformSourceMapURL: true,
      transformAssets: false,
    });
    // cdn loaded
  } else if (isHostedOnCDN(url)) {
    const response = await fetch(url);
    scriptCode = await response.text();
    scriptCode = transformPluginSourceForCDN({
      url,
      source: scriptCode,
      transformSourceMapURL: true,
      transformAssets: true,
    });
  }

  if (scriptCode.length === 0) {
    throw new Error('Only same domain scripts are allowed in sandboxed plugins');
  }

  scriptCode = patchPluginAPIs(scriptCode);
  sandboxEnv.evaluate(scriptCode);
}

export async function getPluginCode(meta: PluginMeta): Promise<string> {
  if (isHostedOnCDN(meta.module)) {
    // Load plugin from CDN, no need for "resolveWithCache" as CDN URLs already include the version
    const url = meta.module;
    const response = await fetch(url);
    let pluginCode = await response.text();
    pluginCode = transformPluginSourceForCDN({
      url,
      source: pluginCode,
      transformSourceMapURL: true,
      transformAssets: true,
    });
    return pluginCode;
  } else {
    let modulePath = resolveModulePath(meta.module);
    // resolveWithCache will append a query parameter with its version
    // to ensure correct cached version is served for local plugins
    const pluginCodeUrl = resolveWithCache(modulePath);
    const response = await fetch(pluginCodeUrl);
    let pluginCode = await response.text();
    pluginCode = transformPluginSourceForCDN({
      url: pluginCodeUrl,
      source: pluginCode,
      transformSourceMapURL: true,
      transformAssets: false,
    });
    pluginCode = patchPluginAPIs(pluginCode);
    return pluginCode;
  }
}

function patchPluginAPIs(pluginCode: string): string {
  return pluginCode.replace(/window\.location/gi, 'window.locationSandbox');
}

export function patchSandboxEnvironmentPrototype(sandboxEnvironment: SandboxEnvironment) {
  // same as https://github.com/grafana/grafana/blob/main/packages/grafana-data/src/types/vector.ts#L16
  // Array is a "reflective" type in Near-membrane and doesn't get an identify continuity
  sandboxEnvironment.evaluate(
    `${patchArrayVectorProrotypeMethods.toString()};${patchArrayVectorProrotypeMethods.name}()`
  );
}
