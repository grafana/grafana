import { type DataSourcePluginMeta, PluginType } from '@grafana/data';

import { config } from '../../config';
import { getFeatureFlagClient } from '../../internal/openFeature';
import { FlagKeys } from '../../internal/openFeature/openfeature.gen';
import { getBackendSrv } from '../backendSrv';

import { FALLBACK_TO_BOOTDATA_ERROR_WARNING, FALLBACK_TO_BOOTDATA_WARNING, META_FAILED_ERROR } from './constants';
import { logPluginMetaDebug, logPluginMetaError, logPluginMetaWarning } from './logging';
import { getDatasourcePluginMapper } from './mappers/mappers';
import { getPluginMetasUrl, initPluginMetas, refetchPluginMetas } from './plugins';
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

export function getPluginIdFromDatasourceInstanceType(type: string, name: string) {
  if (type !== 'datasource') {
    return type;
  }

  if (name === '-- Dashboard --') {
    return 'dashboard';
  }

  if (name === '-- Grafana --') {
    return 'grafana';
  }

  if (name === '-- Mixed --') {
    return 'mixed';
  }

  return '';
}

function extractFromConfig(
  configDatasources: Record<string, { type: string; meta: DataSourcePluginMeta }>
): DatasourcePluginMetas {
  const seen: DatasourcePluginMetas = {};
  for (const ds of Object.values(configDatasources)) {
    const type = getPluginIdFromDatasourceInstanceType(ds.type, ds.meta.name);
    if (!seen[type]) {
      seen[type] = ds.meta;
    }
  }
  return seen;
}

export function setDatasourcePluginMetasFromResponse(metas: PluginMetasResponse | null): void {
  if (
    !metas?.items.length &&
    !getFeatureFlagClient().getBooleanValue(FlagKeys.PluginsDisableMTPluginsFallback, false)
  ) {
    // null means plugin meta failed to load, empty items means the API had nothing
    const message = metas ? FALLBACK_TO_BOOTDATA_WARNING : FALLBACK_TO_BOOTDATA_ERROR_WARNING;
    // eslint-disable-next-line @grafana/no-config-datasources
    setDatasourcesAndAliases(extractFromConfig(config.datasources));
    logPluginMetaWarning(message, { pluginType: PluginType.datasource, requestUrl: getPluginMetasUrl() });
    return;
  }

  if (!metas) {
    logPluginMetaError(META_FAILED_ERROR, { pluginType: PluginType.datasource, requestUrl: getPluginMetasUrl() });
    throw new Error(META_FAILED_ERROR);
  }

  const mapper = getDatasourcePluginMapper();
  setDatasourcesAndAliases(mapper(metas));
  logPluginMetaDebug('PluginMeta: initializing datasource plugins cache with meta values', {});
}

async function initDatasourcePluginMetas(): Promise<void> {
  if (!getFeatureFlagClient().getBooleanValue(FlagKeys.PluginsUseMTPlugins, false)) {
    // eslint-disable-next-line @grafana/no-config-datasources
    setDatasourcesAndAliases(extractFromConfig(config.datasources));
    logPluginMetaDebug('PluginMeta: initializing datasource plugins cache with bootdata values', {});
    return;
  }

  const metas = await initPluginMetas();
  setDatasourcePluginMetasFromResponse(metas);
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

/**
 * Update the metas from an already-fetched `/api/frontend/settings` payload after a data source
 * change. Without MT plugins the metas come from the data sources in boot data, so the first data
 * source of a plugin adds its meta. MT plugin metas change only with a plugin install, update or
 * uninstall, so a data source change leaves them as they are.
 */
export function syncDatasourcePluginMetas(settings: Pick<FrontendSettings, 'datasources'>): void {
  if (getFeatureFlagClient().getBooleanValue(FlagKeys.PluginsUseMTPlugins, false)) {
    return;
  }
  setDatasourcePluginMetasFromBootData(settings.datasources);
}

export function setDatasourcePluginMetasFromBootData(configDatasources: FrontendSettings['datasources']): void {
  setDatasourcesAndAliases(extractFromConfig(configDatasources));
}

export async function refetchDatasourcePluginMetas(): Promise<void> {
  if (!getFeatureFlagClient().getBooleanValue(FlagKeys.PluginsUseMTPlugins, false)) {
    const settings = await getBackendSrv().get<FrontendSettings>('/api/frontend/settings');
    setDatasourcesAndAliases(extractFromConfig(settings.datasources));
    return;
  }

  const metas = await refetchPluginMetas();
  setDatasourcePluginMetasFromResponse(metas);
}
