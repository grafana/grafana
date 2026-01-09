import { config } from '../../config';
import { evaluateBooleanFlag } from '../../internal/openFeature';

import type { PluginMetasResponse } from './types';

let initPromise: Promise<PluginMetasResponse> | null = null;

function getApiVersion(): string {
  return 'v0alpha1';
}

async function loadPluginMetas(): Promise<PluginMetasResponse> {
  if (!evaluateBooleanFlag('useMTPlugins', false)) {
    const result = { items: [] };
    return result;
  }

  const metas = await fetch(`/apis/plugins.grafana.app/${getApiVersion()}/namespaces/${config.namespace}/metas`);
  if (!metas.ok) {
    throw new Error(`Failed to load plugin metas ${metas.status}:${metas.statusText}`);
  }

  const result = await metas.json();
  return result;
}

export function initPluginMetas(): Promise<PluginMetasResponse> {
  if (!initPromise) {
    initPromise = loadPluginMetas();
  }

  return initPromise;
}

export function clearCache() {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('clearCache() function can only be called from tests.');
  }

  initPromise = null;
}
