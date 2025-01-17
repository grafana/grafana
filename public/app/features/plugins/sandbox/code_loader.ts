import { PluginType, patchArrayVectorProrotypeMethods } from '@grafana/data';
import { config } from '@grafana/runtime';

import { transformPluginSourceForCDN } from '../cdn/utils';
import { resolveWithCache } from '../loader/cache';
import { isHostedOnCDN, resolveModulePath } from '../loader/utils';

import { SandboxEnvironment, SandboxPluginMeta } from './types';

function isSameDomainAsHost(url: string): boolean {
  const locationUrl = new URL(window.location.href);
  const paramUrl = new URL(url);
  return locationUrl.host === paramUrl.host;
}

export async function loadScriptIntoSandbox(url: string, sandboxEnv: SandboxEnvironment) {
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

export async function getPluginCode(meta: SandboxPluginMeta): Promise<string> {
  if (isHostedOnCDN(meta.module)) {
    // Load plugin from CDN, no need for "resolveWithCache" as CDN URLs already include the version
    const url = meta.module;
    const response = await fetch(url);

    let pluginCode = await response.text();
    if (!verifySRI(pluginCode, meta.moduleHash)) {
      throw new Error('Invalid SRI for plugin module file');
    }

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
    if (!verifySRI(pluginCode, meta.moduleHash)) {
      throw new Error('Invalid SRI for plugin module file');
    }

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

async function verifySRI(pluginCode: string, moduleHash?: string): Promise<boolean> {
  if (!config.featureToggles.pluginsSriChecks) {
    return true;
  }

  if (!moduleHash || moduleHash.length === 0) {
    return true;
  }

  const [algorithm, _] = moduleHash.split('-');
  const cleanAlgorithm = algorithm.replace('sha', 'SHA-');

  const encoder = new TextEncoder();
  const data = encoder.encode(pluginCode);

  const digest = await crypto.subtle.digest(cleanAlgorithm, data);
  const actualHash = btoa(String.fromCharCode(...new Uint8Array(digest)));

  return `${algorithm}-${actualHash}` === moduleHash;
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

export function getPluginLoadData(pluginId: string): SandboxPluginMeta {
  // find it in datasources
  for (const datasource of Object.values(config.datasources)) {
    if (datasource.type === pluginId) {
      return datasource.meta;
    }
  }

  //find it in panels
  for (const panel of Object.values(config.panels)) {
    if (panel.id === pluginId) {
      return panel;
    }
  }

  //find it in apps
  //the information inside the apps object is more limited
  for (const app of Object.values(config.apps)) {
    if (app.id === pluginId) {
      return {
        id: pluginId,
        type: PluginType.app,
        module: app.path,
        moduleHash: app.moduleHash,
      };
    }
  }

  throw new Error(`Could not find plugin ${pluginId}`);
}
