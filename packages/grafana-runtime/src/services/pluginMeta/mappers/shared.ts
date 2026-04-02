import {
  type AngularMeta,
  type PluginMetaInfo,
  PluginLoadingStrategy,
  PluginSignatureStatus,
  PluginState,
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
  const author = { ...spec.pluginJson.info.author, name: spec.pluginJson.info.author?.name ?? '' };
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

export function stateMapper(spec: v0alpha1Spec): PluginState | undefined {
  const state = spec.pluginJson.state;

  if (state === PluginState.alpha) {
    return PluginState.alpha;
  }

  if (state === PluginState.beta) {
    return PluginState.beta;
  }

  if (state === PluginState.deprecated) {
    return PluginState.deprecated;
  }

  if (state === PluginState.stable) {
    return PluginState.stable;
  }

  return;
}

export function signatureMapper(spec: v0alpha1Spec): PluginSignatureStatus | undefined {
  const signature = spec.signature?.status;
  if (!signature) {
    return;
  }

  if (signature === PluginSignatureStatus.internal) {
    return PluginSignatureStatus.internal;
  }

  if (signature === PluginSignatureStatus.invalid) {
    return PluginSignatureStatus.invalid;
  }

  if (signature === PluginSignatureStatus.modified) {
    return PluginSignatureStatus.modified;
  }

  if (signature === PluginSignatureStatus.valid) {
    return PluginSignatureStatus.valid;
  }

  return;
}
