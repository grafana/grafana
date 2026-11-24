import { isPlainObject } from 'lodash';

import { getEchoSrv } from '../services/EchoSrv';

export type SettingsAccessSource = 'config' | 'bootData';

export type SettingsAccessReporter = (props: { path: string; source: SettingsAccessSource; count: number }) => void;

let report: SettingsAccessReporter | undefined;

// Injected by the app: importing the analytics framework here would create a cycle back to config.ts.
export function setSettingsAccessReporter(reporter: SettingsAccessReporter) {
  report = reporter;
}

const FLUSH_INTERVAL_MS = 30_000;

// Their child keys are user data (datasource/plugin names) with unbounded cardinality, and
// featureToggles is already reported by the legacy feature toggle proxy.
const NO_RECURSE_PATHS = new Set(['datasources', 'panels', 'apps', 'featureToggles']);

const counts = new Map<string, { source: SettingsAccessSource; path: string; count: number }>();
let flushTimer: ReturnType<typeof setInterval> | undefined;

function flushSettingsAccessCounts() {
  // Counts accumulate until the app has wired up a reporter.
  if (!report) {
    return;
  }
  for (const { source, path, count } of counts.values()) {
    try {
      report({ source, path, count });
    } catch {}
  }
  counts.clear();
}

function onPageHide() {
  flushSettingsAccessCounts();
  // Echo only flushes on its own interval, so push the events out before the page goes away.
  try {
    getEchoSrv().flush();
  } catch {}
}

function startFlushing() {
  if (flushTimer) {
    return;
  }
  flushTimer = setInterval(flushSettingsAccessCounts, FLUSH_INTERVAL_MS);
  window.addEventListener('pagehide', onPageHide);
}

function count(source: SettingsAccessSource, path: string) {
  startFlushing();
  const key = `${source}:${path}`;
  const entry = counts.get(key);
  if (entry) {
    entry.count++;
  } else {
    counts.set(key, { source, path, count: 1 });
  }
}

/**
 * Returns a proxy over a settings object that counts every read of every (nested) settings
 * property and reports the counts as analytics events on an interval and on pagehide.
 *
 * `topLevelKeys` limits which top-level keys are counted: `config` also carries class methods and
 * defaults that aren't bootdata settings.
 */
export function trackSettingsAccess<T extends object>(
  target: T,
  source: SettingsAccessSource,
  topLevelKeys?: Set<string>
): T {
  return createProxy(target, source, '', topLevelKeys);
}

function isSettingsObject(value: unknown): value is object {
  return isPlainObject(value);
}

function createProxy<T extends object>(
  target: T,
  source: SettingsAccessSource,
  prefix: string,
  topLevelKeys?: Set<string>
): T {
  // Keyed by the raw child so repeated reads return the same proxy (identity checks keep working),
  // and a replaced child gets a fresh one.
  const children = new WeakMap<object, object>();

  return new Proxy(target, {
    get(obj, property, receiver) {
      const value: unknown = Reflect.get(obj, property, receiver);
      if (typeof property !== 'string' || (topLevelKeys && !topLevelKeys.has(property))) {
        return value;
      }

      const path = prefix ? `${prefix}.${property}` : property;
      count(source, path);

      if (!isSettingsObject(value) || NO_RECURSE_PATHS.has(path)) {
        return value;
      }

      // A proxy get trap must return the exact value of non-writable, non-configurable properties.
      const descriptor = Reflect.getOwnPropertyDescriptor(obj, property);
      if (descriptor && !descriptor.configurable && !descriptor.writable) {
        return value;
      }

      let child = children.get(value);
      if (!child) {
        child = createProxy(value, source, path);
        children.set(value, child);
      }
      return child;
    },
  });
}
