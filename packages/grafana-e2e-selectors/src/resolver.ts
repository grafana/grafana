import { gte, rcompare, valid } from 'semver';

import { VersionedComponents, versionedComponents } from './selectors/components';
import { VersionedPages, versionedPages } from './selectors/pages';
import {
  FunctionSelector,
  Selectors,
  SelectorsOf,
  StringSelector,
  VersionedFunctionSelector,
  VersionedSelectorGroup,
  VersionedSelectors,
  VersionedStringSelector,
} from './types';

/**
 * Resolves selectors based on the Grafana version
 */
export function resolveSelectors(grafanaVersion = 'latest'): {
  pages: SelectorsOf<VersionedPages>;
  components: SelectorsOf<VersionedComponents>;
} {
  const version = grafanaVersion.replace(/\-.*/, '');

  return {
    components: resolveSelectorGroup(versionedComponents, version),
    pages: resolveSelectorGroup(versionedPages, version),
  };
}

function resolveSelectorGroup<T extends Selectors>(
  group: VersionedSelectorGroup,
  grafanaVersion: string
): SelectorsOf<T> {
  const result: Selectors = {};

  for (const [key, value] of Object.entries(group)) {
    if (isVersionedStringSelector(value)) {
      result[key] = resolveStringSelector(value, grafanaVersion);
    }

    if (isVersionedFunctionSelector(value)) {
      result[key] = resolveFunctionSelector(value, grafanaVersion);
    }

    if (isVersionedSelectorGroup(value)) {
      result[key] = resolveSelectorGroup(value, grafanaVersion);
    }
  }

  return result as SelectorsOf<T>;
}

function isVersionedFunctionSelector(
  target: VersionedSelectors | VersionedSelectorGroup
): target is VersionedFunctionSelector {
  if (typeof target === 'object') {
    const [first] = Object.keys(target);
    return !!valid(first) && typeof target[first] === 'function';
  }

  return false;
}

function isVersionedStringSelector(
  target: VersionedSelectors | VersionedSelectorGroup
): target is VersionedStringSelector {
  if (typeof target === 'object') {
    const [first] = Object.keys(target);
    return !!valid(first) && typeof target[first] === 'string';
  }

  return false;
}

function isVersionedSelectorGroup(
  target: VersionedSelectors | VersionedSelectorGroup
): target is VersionedSelectorGroup {
  if (typeof target === 'object') {
    const [first] = Object.keys(target);
    return !valid(first);
  }

  return false;
}

function resolveStringSelector(versionedSelector: VersionedStringSelector, grafanaVersion: string): StringSelector {
  let [versionToUse, ...versions] = Object.keys(versionedSelector).sort(rcompare);

  if (grafanaVersion === 'latest') {
    return versionedSelector[versionToUse];
  }

  for (const version of versions) {
    if (gte(version, grafanaVersion)) {
      versionToUse = version;
    }
  }

  return versionedSelector[versionToUse];
}

function resolveFunctionSelector(
  versionedSelector: VersionedFunctionSelector,
  grafanaVersion: string
): FunctionSelector {
  let [versionToUse, ...versions] = Object.keys(versionedSelector).sort(rcompare);

  if (grafanaVersion === 'latest') {
    return versionedSelector[versionToUse];
  }

  for (const version of versions) {
    if (gte(version, grafanaVersion)) {
      versionToUse = version;
    }
  }

  return versionedSelector[versionToUse];
}
