import { gte, compare, valid } from 'semver';

import {
  FunctionSelector,
  Selectors,
  SelectorsOf,
  StringSelector,
  VersionedSelectorGroup,
  VersionedSelectors,
  CssSelector,
  UrlSelector,
  FunctionSelectorTwoArgs,
} from './types';

/**
 * Resolves selectors based on the Grafana version
 */
export function resolveSelectors<T extends VersionedSelectorGroup>(
  versionedSelectors: T,
  grafanaVersion = 'latest'
): SelectorsOf<T> {
  const version = grafanaVersion.replace(/\-.*/, '');

  return resolveSelectorGroup(versionedSelectors, version);
}

function resolveSelectorGroup<T extends VersionedSelectorGroup>(group: T, grafanaVersion: string): SelectorsOf<T> {
  const result: Selectors = {};

  for (const [key, value] of Object.entries(group)) {
    if (isVersionedSelectorGroup(value)) {
      result[key] = resolveSelectorGroup(value, grafanaVersion);
    } else {
      assertIsSemverValid(value, key);
      result[key] = resolveSelector(value, grafanaVersion);
    }
  }

  return result as SelectorsOf<T>;
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

function resolveSelector(
  versionedSelector: VersionedSelectors,
  grafanaVersion: string
): StringSelector | FunctionSelector | FunctionSelectorTwoArgs | CssSelector | UrlSelector {
  let versionToUse;
  let versions = Object.keys(versionedSelector).sort(compare);

  if (grafanaVersion === 'latest') {
    return versionedSelector[versions[versions.length - 1]];
  }

  for (const version of versions) {
    if (gte(grafanaVersion, version)) {
      versionToUse = version;
    }
  }

  if (!versionToUse) {
    versionToUse = versions[versions.length - 1];
  }

  return versionedSelector[versionToUse];
}

function assertIsSemverValid(versionedSelector: VersionedSelectors, selectorName: string) {
  if (!Object.keys(versionedSelector).every((version) => valid(version))) {
    throw new Error(`Invalid semver version: '${selectorName}'`);
  }
}
