import { type AppPluginConfig, type PluginInclude, PluginIncludeType } from '@grafana/data';

import { logPluginMetaWarning } from '../logging';
import type { AppPluginMetasMapper, PluginMetasResponse } from '../types';
import type { Include as v0alpha1Include, Spec as v0alpha1Spec } from '../types/meta/types.spec.gen';

import { angularMapper, dependenciesMapper, extensionsMapper, loadingStrategyMapper, logosMapper } from './shared';

function includeTypeMapper(type: v0alpha1Include['type']): PluginIncludeType | undefined {
  switch (type) {
    case 'dashboard':
      return PluginIncludeType.dashboard;
    case 'page':
      return PluginIncludeType.page;
    case 'panel':
      return PluginIncludeType.panel;
    case 'datasource':
      return PluginIncludeType.datasource;
    default:
      return undefined;
  }
}

function includesMapper(includes: v0alpha1Include[] = []): PluginInclude[] {
  const result: PluginInclude[] = [];
  for (const include of includes) {
    const type = includeTypeMapper(include.type);
    if (!type) {
      continue;
    }
    result.push({ ...include, type, name: include.name ?? '' });
  }
  return result;
}

function specMapper(spec: v0alpha1Spec): AppPluginConfig {
  const { id, info, name, preload = false } = spec.pluginJson;
  const angular = angularMapper(spec);
  const dependencies = dependenciesMapper(spec, logPluginMetaWarning);
  const extensions = extensionsMapper(spec);
  const loadingStrategy = loadingStrategyMapper(spec);
  const path = spec.module?.path ?? '';
  const version = info.version;
  const buildMode = spec.pluginJson.buildMode ?? 'production';
  const moduleHash = spec.module?.hash;
  const includes = includesMapper(spec.pluginJson.includes);

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
    name,
    includes,
    info: {
      description: info.description,
      // CDN-class plugins carry logo paths relative to spec.baseURL
      logos: logosMapper(spec),
    },
  };
}

export const v0alpha1AppMapper: AppPluginMetasMapper<PluginMetasResponse> = (response) => {
  const result: Record<string, AppPluginConfig> = {};

  return response.items.reduce((acc, curr) => {
    if (curr.spec?.pluginJson?.type !== 'app') {
      return acc;
    }

    try {
      const config = specMapper(curr.spec);
      acc[config.id] = config;
    } catch (error) {
      // One meta missing a field the mapper reads must not cost us the rest:
      // this runs during app plugin init, so throwing here would leave the
      // whole apps cache unpopulated for the session
      logPluginMetaWarning('PluginMeta: skipping an app plugin meta that could not be mapped', {
        pluginId: curr.spec?.pluginJson?.id,
        error: String(error),
      });
    }
    return acc;
  }, result);
};
