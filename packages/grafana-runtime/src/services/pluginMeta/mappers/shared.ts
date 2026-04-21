import {
  type AngularMeta,
  type PluginDependencies,
  type PluginExtensions,
  PluginLoadingStrategy,
  type PluginMetaInfo,
  type PluginType,
} from '@grafana/data';

import type { Spec as v0alpha1Spec } from '../types/meta/types.spec.gen';

export function angularMapper(spec: v0alpha1Spec): AngularMeta {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return { detected: false } as AngularMeta;
}

export function loadingStrategyMapper(spec: v0alpha1Spec): PluginLoadingStrategy {
  const loadingStrategy = spec.module?.loadingStrategy ?? PluginLoadingStrategy.fetch;
  if (loadingStrategy === PluginLoadingStrategy.script) {
    return PluginLoadingStrategy.script;
  }

  return PluginLoadingStrategy.fetch;
}

function toCDNUrl(spec: v0alpha1Spec, path: string): string {
  try {
    const normalizedBase = spec.baseURL.endsWith('/') ? spec.baseURL : `${spec.baseURL}/`;
    const url = new URL(path, normalizedBase);
    return url.toString();
  } catch (error) {
    return path; // plugin without proper CDN URL or builtin plugin
  }
}

function screenshotsMapper(spec: v0alpha1Spec): PluginMetaInfo['screenshots'] {
  if (!spec.pluginJson.info.screenshots) {
    return [];
  }

  return spec.pluginJson.info.screenshots.map((s) => ({
    ...s,
    name: s.name ?? '',
    path: toCDNUrl(spec, s.path ?? ''),
  }));
}

function logosMapper(spec: v0alpha1Spec): PluginMetaInfo['logos'] {
  return {
    ...spec.pluginJson.info.logos,
    large: toCDNUrl(spec, spec.pluginJson.info.logos.large),
    small: toCDNUrl(spec, spec.pluginJson.info.logos.small),
  };
}

export function infoMapper(spec: v0alpha1Spec): PluginMetaInfo {
  const { updated, version, description = '', keywords } = spec.pluginJson.info;
  const author = {
    ...spec.pluginJson.info.author,
    name: spec.pluginJson.info.author?.name ?? '',
    url: spec.pluginJson.info.author?.url ?? '',
  };
  const links = (spec.pluginJson.info.links || []).map((l) => ({ ...l, name: l.name ?? '', url: l.url ?? '' }));
  const screenshots = screenshotsMapper(spec);
  const build = {};
  const logos = logosMapper(spec);

  return {
    author,
    description,
    links,
    logos,
    build,
    screenshots,
    updated,
    version,
    keywords,
  };
}

export function dependenciesMapper(spec: v0alpha1Spec): PluginDependencies {
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

export function extensionsMapper(spec: v0alpha1Spec): PluginExtensions {
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
