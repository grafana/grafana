import { gte, rcompare, valid } from 'semver';

import { E2ESelectorGroup } from './selectors';
import { versionedComponents } from './selectors/components';
import { versionedPages } from './selectors/pages';
import {
  E2ESelectors,
  FunctionSelector,
  Selectors,
  StringSelector,
  VersionedFunctionSelector,
  VersionedSelectorGroup,
  VersionedStringSelector,
} from './types';

/**
 * Resolves selectors based on the Grafana version
 */
export function resolveSelectors(grafanaVersion: string): E2ESelectorGroup {
  const version = grafanaVersion.replace(/\-.*/, '');

  return {
    components: resolveSelectorGroup(versionedComponents, version),
    pages: resolveSelectorGroup(versionedPages, version),
  };
}

function resolveSelectorGroup<T extends Selectors>(
  group: VersionedSelectorGroup,
  grafanaVersion: string
): E2ESelectors<T> {
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

  return result as E2ESelectors<T>;
}

function isVersionedFunctionSelector(
  target: VersionedFunctionSelector | VersionedStringSelector | VersionedSelectorGroup
): target is VersionedFunctionSelector {
  if (typeof target === 'object') {
    const [first] = Object.keys(target);
    return !!valid(first) && typeof target[first] === 'function';
  }

  return false;
}

function isVersionedStringSelector(
  target: VersionedFunctionSelector | VersionedStringSelector | VersionedSelectorGroup
): target is VersionedStringSelector {
  if (typeof target === 'object') {
    const [first] = Object.keys(target);
    return !!valid(first) && typeof target[first] === 'string';
  }

  return false;
}

function isVersionedSelectorGroup(
  target: VersionedFunctionSelector | VersionedStringSelector | VersionedSelectorGroup
): target is VersionedSelectorGroup {
  if (typeof target === 'object') {
    const [first] = Object.keys(target);
    return !valid(first);
  }

  return false;
}

function resolveStringSelector(versionedSelector: VersionedStringSelector, grafanaVersion: string): StringSelector {
  let [versionToUse, ...versions] = Object.keys(versionedSelector).sort(rcompare);

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

  for (const version of versions) {
    if (gte(version, grafanaVersion)) {
      versionToUse = version;
    }
  }

  return versionedSelector[versionToUse];
}
