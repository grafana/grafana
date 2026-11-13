import { config } from '../../config';
import { getFeatureFlagClient } from '../../internal/openFeature';
import { FlagKeys } from '../../internal/openFeature/openfeature.gen';
import { getCachedPromise } from '../../utils/getCachedPromise';
import { assertPluginIdFormat } from '../pluginUtils';

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
  assertPluginIdFormat(pluginId);

  const spec = { ...defaultSpec(), id: pluginId, version };
  const metadata = { name: pluginId, namespace: config.namespace };
  const data: Plugin = {
    apiVersion: `plugins.grafana.app/${getApiVersion()}`,
    kind: 'Plugin',
    metadata,
    spec,
    status: {},
  };

  const pluginsUrl = `apis/plugins.grafana.app/${getApiVersion()}/namespaces/${config.namespace}/plugins`;
  const result = await fetch(pluginsUrl, {
    method: 'POST',
    body: JSON.stringify(data),
    headers: { 'content-type': 'application/json' },
  });

  // The plugin already exists when it is updated or its version is changed, so move the existing resource to the
  // requested version, like the server side install registrar does.
  if (result.status === 409) {
    await updatePluginMetaVersion(`${pluginsUrl}/${pluginId}`, pluginId, version);
    return;
  }

  throwIfNotOk(result, 'install', pluginId);
}

async function updatePluginMetaVersion(url: string, pluginId: string, version: string): Promise<void> {
  const existingResult = await fetch(url);
  throwIfNotOk(existingResult, 'install', pluginId);

  const existing: Plugin = await existingResult.json();
  const updated: Plugin = { ...existing, spec: { ...existing.spec, version } };
  const result = await fetch(url, {
    method: 'PUT',
    body: JSON.stringify(updated),
    headers: { 'content-type': 'application/json' },
  });

  throwIfNotOk(result, 'install', pluginId);
}

function throwIfNotOk(result: Response, action: 'install' | 'uninstall', pluginId: string): void {
  if (result.ok) {
    return;
  }

  const error = new Error(`Failed to ${action} plugin ${pluginId} ${result.status}:${result.statusText}`);
  logPluginMetaError(`PluginMeta: failed to ${action} plugin`, error, {
    pluginId,
    status: String(result.status),
    statusText: result.statusText,
  });
  throw error;
}

export async function uninstallPluginMeta(pluginId: string): Promise<void> {
  assertPluginIdFormat(pluginId);

  const result = await fetch(
    `apis/plugins.grafana.app/${getApiVersion()}/namespaces/${config.namespace}/plugins/${pluginId}`,
    {
      method: 'DELETE',
    }
  );

  // Nothing to remove when the plugin has no resource, which is the state an uninstall is after.
  if (result.status === 404) {
    return;
  }

  throwIfNotOk(result, 'uninstall', pluginId);
}

export function initPluginMetas(): Promise<PluginMetasResponse | null> {
  return getCachedPromise<PluginMetasResponse | null>(loadPluginMetas, { defaultValue: null });
}

export function refetchPluginMetas(): Promise<PluginMetasResponse | null> {
  return getCachedPromise<PluginMetasResponse | null>(loadPluginMetas, {
    defaultValue: null,
    invalidate: true,
  });
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
