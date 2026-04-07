import { type AngularMeta, PluginLoadingStrategy } from '@grafana/data';

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

export function isCorePlugin(spec: v0alpha1Spec): boolean {
  return spec.class === 'core';
}

export function isDecoupledCorePlugin(spec: v0alpha1Spec): boolean {
  return isCorePlugin(spec) && !spec.module?.path?.startsWith('core:');
}

export function normalizeEnd(url: string): string {
  if (url.endsWith('/')) {
    return url;
  }

  return `${url}/`;
}

export function combinePathAndUrl(url: string, path: string): string {
  const normalized = normalizeEnd(url);
  try {
    const returnUrl = new URL(path, normalized);
    return returnUrl.toString();
  } catch (error) {
    return `${normalized}${path}`;
  }
}
