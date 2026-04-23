import { type DataSourcePluginMeta, PluginType } from '@grafana/data';

import { config } from '../../config';
import { getFeatureFlagClient } from '../../internal/openFeature';
import { getBackendSrv } from '../backendSrv';

import { FALLBACK_TO_BOOTDATA_WARNING } from './constants';
import { logPluginMetaWarning } from './logging';
import { getDatasourcePluginMapper } from './mappers/mappers';
import { initPluginMetas, refetchPluginMetas } from './plugins';
import type { DatasourcePluginMetas, FrontendSettings, PluginMetasResponse } from './types';

let datasources: DatasourcePluginMetas = {};
let datasourcesByAliasIDs: DatasourcePluginMetas = {};

function initialized(): boolean {
  return Boolean(Object.keys(datasources).length);
}

function resolveAliasIDs(input: DatasourcePluginMetas): DatasourcePluginMetas {
  const keys = Object.keys(input);
  const byAliasIDs: DatasourcePluginMetas = {};

  for (let i = 0; i < keys.length; i++) {
    const pluginId = keys[i];
    const datasource = input[pluginId];
    const aliases = datasource?.aliasIDs;

    if (!aliases?.length) {
      continue;
    }

    for (let j = 0; j < aliases.length; j++) {
      const alias = aliases[j];
      byAliasIDs[alias] = datasource;
    }
  }

  return byAliasIDs;
}

function setDatasourcesAndAliases(input: DatasourcePluginMetas) {
  datasources = input;
  datasourcesByAliasIDs = resolveAliasIDs(input);
}

function extractFromConfig(
  configDatasources: Record<string, { type: string; meta: DataSourcePluginMeta }>
): DatasourcePluginMetas {
  const seen: DatasourcePluginMetas = {};
  for (const ds of Object.values(configDatasources)) {
    if (!seen[ds.meta.id]) {
      seen[ds.meta.id] = ds.meta;
    }
  }
  return seen;
}

function setMetas(metas: PluginMetasResponse) {
  if (!metas.items.length) {
    // something failed while trying to fetch plugin meta
    // fallback to config.datasources from bootdata
    // eslint-disable-next-line no-restricted-syntax
    setDatasourcesAndAliases(extractFromConfig(config.datasources));
    logPluginMetaWarning(FALLBACK_TO_BOOTDATA_WARNING, PluginType.datasource);
    return;
  }

  const mapper = getDatasourcePluginMapper();
  setDatasourcesAndAliases(mapper(metas));
}

async function initDatasourcePluginMetas(): Promise<void> {
  if (!getFeatureFlagClient().getBooleanValue('useMTPlugins', false)) {
    // eslint-disable-next-line no-restricted-syntax
    setDatasourcesAndAliases(extractFromConfig(config.datasources));
    return;
  }

  const metas = await initPluginMetas();
  setMetas(metas);
}

export async function getDatasourcePluginMetas(): Promise<DataSourcePluginMeta[]> {
  if (!initialized()) {
    await initDatasourcePluginMetas();
  }

  return Object.values(structuredClone(datasources));
}

export async function getDatasourcePluginMeta(pluginId: string): Promise<DataSourcePluginMeta | null> {
  if (!initialized()) {
    await initDatasourcePluginMetas();
  }

  const datasource = datasources[pluginId];
  if (datasource) {
    return structuredClone(datasource);
  }

  // Check alias values before failing
  const aliased = datasourcesByAliasIDs[pluginId];
  if (aliased) {
    return structuredClone(aliased);
  }

  return null;
}

export function setDatasourcePluginMetas(override: DatasourcePluginMetas): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('setDatasourcePluginMetas() function can only be called from tests.');
  }

  setDatasourcesAndAliases(structuredClone(override));
}

export async function refetchDatasourcePluginMetas(settings?: FrontendSettings): Promise<void> {
  if (!getFeatureFlagClient().getBooleanValue('useMTPlugins', false)) {
    const resolved = settings ?? (await getBackendSrv().get<FrontendSettings>('/api/frontend/settings'));
    setDatasourcesAndAliases(extractFromConfig(resolved.datasources));
    return;
  }

  const metas = await refetchPluginMetas();
  setMetas(metas);
}
