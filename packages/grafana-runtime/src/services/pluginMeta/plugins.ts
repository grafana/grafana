import { config } from '../../config';
import { getFeatureFlagClient } from '../../internal/openFeature';
import { FlagKeys } from '../../internal/openFeature/openfeature.gen';
import { getCachedPromise } from '../../utils/getCachedPromise';

import { logPluginMetaError } from './logging';
import type { PluginMetasResponse } from './types';
import { type Meta } from './types/meta/meta_object_gen';
import { type Plugin } from './types/plugin/plugin_object_gen';
import { defaultSpec } from './types/plugin/types.spec.gen';

function getApiVersion(): string {
  return 'v0alpha1';
}

export function getPluginMetasUrl(): string {
  return `apis/plugins.grafana.app/${getApiVersion()}/namespaces/${config.namespace}/metas`;
}

async function loadPluginMetas(): Promise<PluginMetasResponse> {
  if (!getFeatureFlagClient().getBooleanValue(FlagKeys.PluginsUseMTPlugins, false)) {
    const result = { items: [] };
    return result;
  }

  const requestUrl = getPluginMetasUrl();
  const metas = await fetch(requestUrl);
  if (!metas.ok) {
    const error = new Error(`Failed to load plugin metas ${metas.status}:${metas.statusText}`);
    logPluginMetaError('PluginMeta: failed to load plugin metas', error, {
      requestUrl,
      status: String(metas.status),
      statusText: metas.statusText,
    });
    throw error;
  }

  const result = await metas.json();
  return result;
}

export async function installPluginMeta(pluginId: string, version: string): Promise<void> {
  if (!getFeatureFlagClient().getBooleanValue(FlagKeys.PluginsUseMTPlugins, false)) {
    return;
  }

  const spec = { ...defaultSpec(), id: pluginId, version };
  const metadata = { name: pluginId, namespace: config.namespace };
  const data: Plugin = {
    apiVersion: `plugins.grafana.app/${getApiVersion()}`,
    kind: 'Plugin',
    metadata,
    spec,
    status: {},
  };

  const result = await fetch(`apis/plugins.grafana.app/${getApiVersion()}/namespaces/${config.namespace}/plugins`, {
    method: 'POST',
    body: JSON.stringify(data),
    headers: { 'content-type': 'application/json' },
  });

  if (!result.ok) {
    const error = new Error(`Failed to install plugin ${pluginId} ${result.status}:${result.statusText}`);
    logPluginMetaError('PluginMeta: failed to install plugin', error, {
      pluginId,
      status: String(result.status),
      statusText: result.statusText,
    });
    throw error;
  }
}

export async function uninstallPluginMeta(pluginId: string): Promise<void> {
  if (!getFeatureFlagClient().getBooleanValue(FlagKeys.PluginsUseMTPlugins, false)) {
    return;
  }

  const result = await fetch(
    `apis/plugins.grafana.app/${getApiVersion()}/namespaces/${config.namespace}/plugins/${pluginId}`,
    {
      method: 'DELETE',
    }
  );

  if (!result.ok) {
    const error = new Error(`Failed to uninstall plugin ${pluginId} ${result.status}:${result.statusText}`);
    logPluginMetaError('PluginMeta: failed to uninstall plugin', error, {
      pluginId,
      status: String(result.status),
      statusText: result.statusText,
    });
    throw error;
  }
}

// The single shared cache entry for the metas fetch. Errors always propagate
// out of the cache (invalidating the entry so a later call retries) and each
// accessor applies its own fallback OUTSIDE the cache: with a defaultValue
// baked into the cached promise, whichever accessor ran first would decide
// the failure behaviour for every other caller.
function cachedPluginMetas(invalidate = false): Promise<PluginMetasResponse> {
  return getCachedPromise(loadPluginMetas, { invalidate });
}

export function initPluginMetas(): Promise<PluginMetasResponse | null> {
  return cachedPluginMetas().catch(() => null);
}

/**
 * Like {@link initPluginMetas} but without the null fallback: a failed fetch
 * rejects. Both share the same cache entry, so a successful fetch is only
 * made once either way.
 */
export function fetchPluginMetas(): Promise<PluginMetasResponse> {
  return cachedPluginMetas();
}

export function refetchPluginMetas(): Promise<PluginMetasResponse | null> {
  return cachedPluginMetas(true).catch(() => null);
}

export async function getPluginMetaFromCache(pluginId: string): Promise<Meta | null> {
  if (!getFeatureFlagClient().getBooleanValue(FlagKeys.PluginsUseMTPlugins, false)) {
    return null;
  }

  const metas = await initPluginMetas();
  const meta = metas?.items.find((i) => i.spec.pluginJson.id === pluginId);
  return meta ? structuredClone(meta) : null;
}

export async function refetchPluginMeta(pluginId: string): Promise<Meta | null> {
  if (!getFeatureFlagClient().getBooleanValue(FlagKeys.PluginsUseMTPlugins, false)) {
    return null;
  }

  const metas = await refetchPluginMetas();
  const meta = metas?.items.find((i) => i.spec.pluginJson.id === pluginId);
  return meta ? structuredClone(meta) : null;
}
