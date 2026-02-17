import { config } from '../../config';
import { getFeatureFlagClient } from '../../internal/openFeature';
import { getCachedPromise } from '../../utils/getCachedPromise';

import type { PluginMetasResponse } from './types';

function getApiVersion(): string {
  return 'v0alpha1';
}

async function loadPluginMetas(): Promise<PluginMetasResponse> {
  if (!getFeatureFlagClient().getBooleanValue('useMTPlugins', false)) {
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

export function initPluginMetas(): Promise<PluginMetasResponse> {
  return getCachedPromise(loadPluginMetas, { defaultValue: { items: [] } });
}

export function refetchPluginMetas(): Promise<PluginMetasResponse> {
  return getCachedPromise(loadPluginMetas, { defaultValue: { items: [] }, invalidate: true });
}
