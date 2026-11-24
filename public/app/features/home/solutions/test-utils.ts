import { type DataSourceInstanceListItem } from '@grafana/data';
import { DataSourceWithBackend, type getDataSourceInstance } from '@grafana/runtime';

import { type Solution, type SolutionId } from './types';

/** Datasource that proved data; card tests assert its name as `via Prometheus`. */
export const stubDatasource: DataSourceInstanceListItem = {
  uid: 'prometheus',
  name: 'Prometheus',
  type: 'prometheus',
  meta: { id: 'prometheus' } as DataSourceInstanceListItem['meta'],
};

/** Inert solution: every fact resolves empty or inactive; override what the test observes. */
export function stubSolution(id: SolutionId, overrides: Partial<Solution> = {}): Solution {
  return {
    id,
    title: id,
    icon: 'chart-line',
    signal: async () => 'inactive',
    datasource: async () => null,
    needsAttention: async () => false,
    stats: async () => null,
    refinedStats: async () => null,
    sparkline: async () => null,
    cta: async () => null,
    alert: async () => null,
    offer: async () => null,
    ...overrides,
  };
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

/** Passes the backend-instance check and serves resource calls from `getResource`. */
export function backendInstance(getResource: jest.Mock): DataSourceWithBackend {
  const instance: DataSourceWithBackend = Object.create(DataSourceWithBackend.prototype);
  instance.getResource = getResource;
  return instance;
}

/**
 * `getDataSourceInstance` stand-in whose instances answer `callHealthCheck` through `get` at the legacy
 * health URL, so suites keep stubbing health per URL now that probes go through callHealthCheck().
 */
export function healthCheckThrough(get: jest.Mock): typeof getDataSourceInstance {
  return async (ref) => {
    const uid = typeof ref === 'string' ? ref : ref?.uid;
    const instance = backendInstance(jest.fn());
    instance.callHealthCheck = (options) => get(`/api/datasources/uid/${uid}/health`, undefined, undefined, options);
    return instance;
  };
}
