import { type DataSourcePluginMeta, PluginType } from '@grafana/data';

import type { DatasourcePluginMetas, DatasourcePluginMetasMapper, PluginMetasResponse } from '../types';
import type { Spec as v0alpha1Spec } from '../types/meta/types.spec.gen';

import {
  angularMapper,
  infoMapper,
  loadingStrategyMapper,
  signatureStatusMapper,
  stateMapper,
  prependPublicPathToCorePlugins,
  isCorePlugin,
} from './shared';

export function coreSpecMapper(spec: v0alpha1Spec): DataSourcePluginMeta {
  const mapped = specMapper(spec);
  return prependPublicPathToCorePlugins(mapped, spec);
}

function specMapper(spec: v0alpha1Spec): DataSourcePluginMeta {
  const {
    id,
    name,
    metrics,
    logs,
    annotations,
    alerting,
    tracing,
    streaming,
    backend,
    builtIn,
    category,
    queryOptions,
    multiValueFilterOperators,
  } = spec.pluginJson;
  const state = stateMapper(spec);
  const info = infoMapper(spec);
  const loadingStrategy = loadingStrategyMapper(spec);
  const type = PluginType.datasource;
  const module = spec.module.path;
  const baseUrl = spec.baseURL;
  const signature = signatureStatusMapper(spec);
  const angular = angularMapper(spec);
  const translations = spec.translations;
  const moduleHash = spec.module.hash;
  const aliasIDs = spec.aliasIds;

  return {
    id,
    name,
    info,
    state,
    baseUrl,
    signature,
    module,
    angular,
    loadingStrategy,
    type,
    translations,
    moduleHash,
    aliasIDs,
    metrics,
    logs,
    annotations,
    alerting,
    tracing,
    streaming,
    backend,
    builtIn,
    category,
    queryOptions,
    multiValueFilterOperators,
  };
}

export const v0alpha1DatasourceMapper: DatasourcePluginMetasMapper<PluginMetasResponse> = (response) => {
  const result: DatasourcePluginMetas = {};

  return response.items.reduce((acc, curr) => {
    if (curr.spec.pluginJson.type !== 'datasource') {
      return acc;
    }

    const mapper = isCorePlugin(curr.spec) ? coreSpecMapper : specMapper;

    const config = mapper(curr.spec);
    acc[config.id] = config;
    return acc;
  }, result);
};
