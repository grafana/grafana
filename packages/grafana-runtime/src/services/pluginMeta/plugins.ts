import { config } from '../../config';
import { getFeatureFlagClient } from '../../internal/openFeature';
import { FlagKeys } from '../../internal/openFeature/openfeature.gen';
import { getCachedPromise } from '../../utils/getCachedPromise';

import { logPluginMetaError } from './logging';
import type { PluginMetasResponse } from './types';
import { type Meta } from './types/meta/meta_object_gen';

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
