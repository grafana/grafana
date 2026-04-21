import { type AppPluginConfig } from '@grafana/data';

import type { AppPluginMetas, AppPluginMetasMapper, PluginMetasResponse } from '../types';
import type { Spec as v0alpha1Spec } from '../types/meta/types.spec.gen';

import { angularMapper, dependenciesMapper, extensionsMapper, loadingStrategyMapper } from './shared';

function specMapper(spec: v0alpha1Spec): AppPluginConfig {
  const { id, info, preload = false } = spec.pluginJson;
  const angular = angularMapper(spec);
  const dependencies = dependenciesMapper(spec);
  const extensions = extensionsMapper(spec);
  const loadingStrategy = loadingStrategyMapper(spec);
  const path = spec.module?.path ?? '';
  const version = info.version;
  const buildMode = spec.pluginJson.buildMode ?? 'production';
  const moduleHash = spec.module?.hash;

  return {
    id,
    angular,
    dependencies,
    extensions,
    loadingStrategy,
    path,
    preload,
    version,
    buildMode,
    moduleHash,
  };
}

export const v0alpha1AppMapper: AppPluginMetasMapper<PluginMetasResponse> = (response) => {
  const result: AppPluginMetas = {};

  return response.items.reduce((acc, curr) => {
    if (curr.spec.pluginJson.type !== 'app') {
      return acc;
    }

    const config = specMapper(curr.spec);
    acc[config.id] = config;
    return acc;
  }, result);
};
