import type { DataSourcePluginMeta } from '@grafana/data';

import { config } from '../../config';
import { getFeatureFlagClient } from '../../internal/openFeature';
import { getBackendSrv } from '../backendSrv';

import { getDatasourcePluginMapper } from './mappers/mappers';
import { initPluginMetas, refetchPluginMetas } from './plugins';
import type { DatasourcePluginMetas } from './types';

let datasources: DatasourcePluginMetas = {};

function initialized(): boolean {
  return Boolean(Object.keys(datasources).length);
}

function extractFromConfig(
  configDatasources: Record<string, { type: string; meta: DataSourcePluginMeta }>
): DatasourcePluginMetas {
  const seen: DatasourcePluginMetas = {};
  for (const ds of Object.values(configDatasources)) {
    if (!seen[ds.type]) {
      seen[ds.type] = ds.meta;
    }
  }
  return seen;
}

async function initDatasourcePluginMetas(): Promise<void> {
  if (!getFeatureFlagClient().getBooleanValue('useMTPlugins', false)) {
    // eslint-disable-next-line no-restricted-syntax
    datasources = extractFromConfig(config.datasources);
    return;
  }

  const metas = await initPluginMetas();
  const mapper = getDatasourcePluginMapper();
  datasources = mapper(metas);
}

export async function getDatasourcePluginMetas(): Promise<DataSourcePluginMeta[]> {
  if (!initialized()) {
    await initDatasourcePluginMetas();
  }

  return Object.values(structuredClone(datasources));
}

export async function getDatasourcePluginMetasMap(): Promise<DatasourcePluginMetas> {
  if (!initialized()) {
    await initDatasourcePluginMetas();
  }

  return structuredClone(datasources);
}

/**
 * Get a map of datasource plugins keyed by plugin id.
 * This is a synchronous function that should only be used as an escape hatch in cases where the caller is guaranteed to be called after the datasource plugins have been initialized.
 * In other cases, getDatasourcePluginMetasMap() should be used instead to ensure the datasource plugins have been initialized before accessing them.
 * @throws Error if the datasource plugins have not been initialized yet
 * @returns a map of datasource plugins keyed by plugin id
 */
export function getDatasourcePluginMetasMapSync(): DatasourcePluginMetas {
  if (!initialized() && process.env.NODE_ENV === 'development') {
    throw new Error('getDatasourcePluginMetasMapSync() was called before datasource plugins map was initialized!');
  }
  return structuredClone(datasources);
}

export async function getDatasourcePluginMeta(pluginId: string): Promise<DataSourcePluginMeta | null> {
  if (!initialized()) {
    await initDatasourcePluginMetas();
  }

  const datasource = datasources[pluginId];
  if (datasource) {
    return structuredClone(datasource);
  }

  return null;
}

export function setDatasourcePluginMetas(override: DatasourcePluginMetas): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('setDatasourcePluginMetas() function can only be called from tests.');
  }

  datasources = structuredClone(override);
}

export async function refetchDatasourcePluginMetas(): Promise<void> {
  if (!getFeatureFlagClient().getBooleanValue('useMTPlugins', false)) {
    const settings = await getBackendSrv().get('/api/frontend/settings');
    datasources = extractFromConfig(settings.datasources);
    return;
  }

  const metas = await refetchPluginMetas();
  const mapper = getDatasourcePluginMapper();
  datasources = mapper(metas);
}
