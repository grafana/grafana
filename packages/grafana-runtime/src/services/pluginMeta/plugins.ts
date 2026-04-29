import { config } from '../../config';
import { getFeatureFlagClient } from '../../internal/openFeature';
import { FlagKeys } from '../../internal/openFeature/openfeature.gen';
import { getCachedPromise } from '../../utils/getCachedPromise';

import type { PluginMetasResponse } from './types';
import { type Meta } from './types/meta/meta_object_gen';
import { type Plugin } from './types/plugin/plugin_object_gen';
import { defaultSpec } from './types/plugin/types.spec.gen';

function getApiVersion(): string {
  return 'v0alpha1';
}

async function loadPluginMetas(): Promise<PluginMetasResponse> {
  if (!getFeatureFlagClient().getBooleanValue(FlagKeys.UseMTPlugins, false)) {
    const result = { items: [] };
    return result;
  }

  const metas = await fetch(`apis/plugins.grafana.app/${getApiVersion()}/namespaces/${config.namespace}/metas`);
  if (!metas.ok) {
    throw new Error(`Failed to load plugin metas ${metas.status}:${metas.statusText}`);
  }

  const result = await metas.json();
  return result;
}

export async function installPluginMeta(pluginId: string, version: string): Promise<void> {
  if (!getFeatureFlagClient().getBooleanValue(FlagKeys.UseMTPlugins, false)) {
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
    throw new Error(`Failed to install plugin ${pluginId} ${result.status}:${result.statusText}`);
  }
}

export async function uninstallPluginMeta(pluginId: string): Promise<void> {
  if (!getFeatureFlagClient().getBooleanValue(FlagKeys.UseMTPlugins, false)) {
    return;
  }

  const result = await fetch(
    `apis/plugins.grafana.app/${getApiVersion()}/namespaces/${config.namespace}/plugins/${pluginId}`,
    {
      method: 'DELETE',
    }
  );

  if (!result.ok) {
    throw new Error(`Failed to uninstall plugin ${pluginId} ${result.status}:${result.statusText}`);
  }
}

export function initPluginMetas(): Promise<PluginMetasResponse> {
  return getCachedPromise(loadPluginMetas, { cacheKey: 'loadPluginMetas', defaultValue: { items: [] } });
}

export function refetchPluginMetas(): Promise<PluginMetasResponse> {
  return getCachedPromise(loadPluginMetas, {
    cacheKey: 'loadPluginMetas',
    defaultValue: { items: [] },
    invalidate: true,
  });
}

export async function getPluginMetaFromCache(pluginId: string): Promise<Meta | null> {
  if (!getFeatureFlagClient().getBooleanValue('useMTPlugins', false)) {
    return null;
  }

  const metas = await initPluginMetas();
  const meta = metas.items.find((i) => i.spec.pluginJson.id === pluginId);
  return meta ? structuredClone(meta) : null;
}

export async function refetchPluginMeta(pluginId: string): Promise<Meta | null> {
  if (!getFeatureFlagClient().getBooleanValue('useMTPlugins', false)) {
    return null;
  }

  const metas = await refetchPluginMetas();
  const meta = metas.items.find((i) => i.spec.pluginJson.id === pluginId);
  return meta ? structuredClone(meta) : null;
}
