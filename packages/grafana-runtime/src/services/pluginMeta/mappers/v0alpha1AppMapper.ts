import {
  type AngularMeta,
  type AppPluginConfig,
  type PluginDependencies,
  type PluginExtensions,
  PluginLoadingStrategy,
  type PluginType,
} from '@grafana/data';

import type { Spec as v0alpha1Spec } from '../../../../../../apps/plugins/plugin/src/generated/meta/v0alpha1/types.spec.gen';
import type { AppPluginMetas, AppPluginMetasMapper, PluginMetasResponse } from '../types';

function angularyMapper(spec: v0alpha1Spec): AngularMeta {
  const detected = spec.angular?.detected ?? false;

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return { detected } as AngularMeta;
}

function dependenciesMapper(spec: v0alpha1Spec): PluginDependencies {
  const plugins = (spec.pluginJson.dependencies?.plugins ?? []).map((v) => ({
    ...v,
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    type: v.type as PluginType,
    version: '',
  }));

  const dependencies: PluginDependencies = {
    ...spec.pluginJson.dependencies,
    extensions: {
      exposedComponents: spec.pluginJson.dependencies.extensions?.exposedComponents ?? [],
    },
    grafanaDependency: spec.pluginJson.dependencies.grafanaDependency,
    grafanaVersion: spec.pluginJson.dependencies.grafanaVersion ?? '',
    plugins,
  };

  return dependencies;
}

function extensionsMapper(spec: v0alpha1Spec): PluginExtensions {
  const addedComponents = spec.pluginJson.extensions?.addedComponents ?? [];
  const addedFunctions = spec.pluginJson.extensions?.addedFunctions ?? [];
  const addedLinks = spec.pluginJson.extensions?.addedLinks ?? [];
  const exposedComponents = (spec.pluginJson.extensions?.exposedComponents ?? []).map((v) => ({
    ...v,
    description: v.description ?? '',
    title: v.title ?? '',
  }));
  const extensionPoints = (spec.pluginJson.extensions?.extensionPoints ?? []).map((v) => ({
    ...v,
    description: v.description ?? '',
    title: v.title ?? '',
  }));

  const extensions: PluginExtensions = {
    addedComponents,
    addedFunctions,
    addedLinks,
    exposedComponents,
    extensionPoints,
  };

  return extensions;
}

function loadingStrategyMapper(spec: v0alpha1Spec): PluginLoadingStrategy {
  const loadingStrategy = spec.module?.loadingStrategy ?? PluginLoadingStrategy.fetch;
  if (loadingStrategy === PluginLoadingStrategy.script) {
    return PluginLoadingStrategy.script;
  }

  return PluginLoadingStrategy.fetch;
}

function specMapper(spec: v0alpha1Spec): AppPluginConfig {
  const { id, info, preload = false } = spec.pluginJson;
  const angular = angularyMapper(spec);
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
