import { type DataSourceInstanceListItem } from '@grafana/data';

import { type Solution, type SolutionId } from './types';

/** Datasource that proved data; card tests assert its name as `via Prometheus`. */
export const stubDatasource: DataSourceInstanceListItem = {
  uid: 'prometheus',
  name: 'Prometheus',
  type: 'prometheus',
  meta: { id: 'prometheus' } as DataSourceInstanceListItem['meta'],
  readOnly: false,
  isDefault: true,
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
