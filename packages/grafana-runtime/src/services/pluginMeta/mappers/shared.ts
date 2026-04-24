import {
  type AngularMeta,
  type PluginDependencies,
  type PluginExtensions,
  PluginLoadingStrategy,
  type PluginMetaInfo,
  PluginSignatureStatus,
  PluginState,
  type PluginType,
} from '@grafana/data';

import { logPluginSettingsWarning } from '../../pluginSettings/logging';
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

export function toCDNUrl(spec: v0alpha1Spec, path: string): string {
  try {
    const normalizedBase = spec.baseURL.endsWith('/') ? spec.baseURL : `${spec.baseURL}/`;
    const url = new URL(path, normalizedBase);
    return url.toString();
  } catch (error) {
    return path; // plugin without proper CDN URL or builtin plugin
  }
}

export function screenshotsMapper(spec: v0alpha1Spec): PluginMetaInfo['screenshots'] {
  if (!spec.pluginJson.info.screenshots) {
    return [];
  }

  return spec.pluginJson.info.screenshots.map((s) => ({
    ...s,
    name: s.name ?? '',
    path: toCDNUrl(spec, s.path ?? ''),
  }));
}

export function logosMapper(spec: v0alpha1Spec): PluginMetaInfo['logos'] {
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

export function stateMapper(spec: v0alpha1Spec): PluginState {
  switch (spec.pluginJson.state) {
    case 'alpha':
      return PluginState.alpha;
    case 'beta':
      return PluginState.beta;
    case 'deprecated':
      return PluginState.deprecated;
    case 'stable':
      return PluginState.stable;
    default:
      logPluginSettingsWarning(`stateMapper: unknown PluginState ${spec.pluginJson.state}`, spec.pluginJson.id);
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return (spec.pluginJson.state ?? '') as PluginState;
  }
}

export function signatureStatusMapper(spec: v0alpha1Spec): PluginSignatureStatus {
  switch (spec.signature.status) {
    case 'internal':
      return PluginSignatureStatus.internal;
    case 'invalid':
      return PluginSignatureStatus.invalid;
    case 'modified':
      return PluginSignatureStatus.modified;
    case 'valid':
      return PluginSignatureStatus.valid;
    default:
      logPluginSettingsWarning(
        `signatureStatusMapper: unknown PluginSignatureStatus ${spec.signature.status}`,
        spec.pluginJson.id
      );
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return (spec.signature.status ?? '') as PluginSignatureStatus;
  }
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
