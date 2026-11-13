import { type RouterStatus } from './RouterStatusPage';

export const status: RouterStatus = {
  ready: false,
  reconciler: { phase: 'serving', last: '2026-10-26T10:00:00Z', lastFailed: true, total: 12, errors: 3 },
  breakers: { openAfterConsecutiveFailures: 5, openFor: '30s' },
  groups: [
    {
      group: 'dashboard.grafana.app',
      source: 'local',
      key: 'dash-key',
      health: 'unavailable',
      breaker: {
        scope: 'requests',
        state: 'open',
        requests: 9,
        successes: 4,
        failures: 5,
        consecutiveFailures: 5,
      },
      plugin: { id: 'my-plugin', version: '1.2.3', hasBackend: true },
      loadedAt: '2026-10-26T09:00:00Z',
      manifest: true,
      visibility: 'public',
      discovery: 'cached',
      openapiCached: ['v1', 'v2'],
      watches: 7,
    },
  ],
  loadFailures: [
    {
      group: 'broken.grafana.app',
      key: 'broken-key',
      failures: 4,
      since: '2026-10-26T08:00:00Z',
      retryAt: '2026-10-26T11:00:00Z',
      serving: false,
    },
  ],
};

export const cloudStatus: RouterStatus = {
  ...status,
  ready: true,
  groups: [
    { ...status.groups[0], source: 'core', health: 'ok' },
    {
      ...status.groups[0],
      group: 'iam.grafana.app',
      key: 'st-key',
      source: 'single-tenant',
      health: 'unknown',
      breaker: { scope: 'per-destination', requests: 0, successes: 0, failures: 0, consecutiveFailures: 0 },
      plugin: undefined,
    },
  ],
  loadFailures: undefined,
  sources: [
    { source: 'single-tenant', lastSuccess: '0001-01-01T00:00:00Z', successes: 0, failures: 2, skipped: 1 },
    { source: 'core', lastSuccess: '2026-10-26T09:00:00Z', successes: 8, failures: 0, skipped: 0 },
  ],
  shadowed: [{ group: 'dashboard.grafana.app', source: 'single-tenant', servedBy: 'core' }],
  stackLookups: { error: 1, resolved: 40, cache_hit: 300 },
};
