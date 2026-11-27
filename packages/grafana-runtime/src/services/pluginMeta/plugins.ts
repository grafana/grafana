import { config } from '../../config';
import { getFeatureFlagClient } from '../../internal/openFeature';
import { FlagKeys } from '../../internal/openFeature/openfeature.gen';
import { getCachedPromise } from '../../utils/getCachedPromise';
import { assertPluginIdFormat, getApiVersion } from '../pluginUtils';

import { logPluginMetaError } from './logging';
import type { PluginMetasResponse } from './types';
import { type Meta } from './types/meta/meta_object_gen';
import { type Plugin } from './types/plugin/plugin_object_gen';
import { defaultSpec } from './types/plugin/types.spec.gen';

export async function getPluginMetasUrl(): Promise<string> {
  return `apis/plugins.grafana.app/${await getApiVersion()}/namespaces/${config.namespace}/metas`;
}

async function loadPluginMetas(): Promise<PluginMetasResponse> {
  if (!getFeatureFlagClient().getBooleanValue(FlagKeys.PluginsUseMTPlugins, false)) {
    const result = { items: [] };
    return result;
  }

  const requestUrl = await getPluginMetasUrl();
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

export async function installPluginMeta(
  pluginId: string,
  version: string,
  { updateExisting = false }: { updateExisting?: boolean } = {}
): Promise<void> {
  assertPluginIdFormat(pluginId);

  const apiVersion = await getApiVersion();
  const pluginsUrl = `apis/plugins.grafana.app/${apiVersion}/namespaces/${config.namespace}/plugins`;

  if (!updateExisting) {
    return createPluginMeta(pluginsUrl, apiVersion, pluginId, version);
  }

  const pluginUrl = `${pluginsUrl}/${pluginId}`;
  const existingResult = await fetch(pluginUrl);
  if (existingResult.status === 404) {
    return createPluginMeta(pluginsUrl, apiVersion, pluginId, version);
  }

  throwIfNotOk(existingResult, 'install', pluginId);
  const existing: Plugin = await existingResult.json();

  const updated = await fetch(pluginUrl, {
    method: 'PUT',
    body: JSON.stringify({ ...existing, spec: { ...existing.spec, version } }),
    headers: { 'content-type': 'application/json' },
  });
  throwIfNotOk(updated, 'install', pluginId);
}

async function createPluginMeta(
  pluginsUrl: string,
  apiVersion: string,
  pluginId: string,
  version: string
): Promise<void> {
  const data: Plugin = {
    apiVersion: `plugins.grafana.app/${apiVersion}`,
    kind: 'Plugin',
    metadata: { name: pluginId, namespace: config.namespace },
    spec: { ...defaultSpec(), id: pluginId, version },
    status: {},
  };
  const created = await fetch(pluginsUrl, {
    method: 'POST',
    body: JSON.stringify(data),
    headers: { 'content-type': 'application/json' },
  });
  throwIfNotOk(created, 'install', pluginId);
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
    `apis/plugins.grafana.app/${await getApiVersion()}/namespaces/${config.namespace}/plugins/${pluginId}`,
    {
      method: 'DELETE',
    }
  );

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
