import { renderHook } from '@testing-library/react';

import type { Check } from '@grafana/api-clients/rtkq/advisor/v0alpha1';

import {
  findLatestDatasourceCheck,
  getEffectiveAdvisorHealthMap,
  useAdvisorHealthStatus,
} from './useAdvisorHealthStatus';

jest.mock('@grafana/runtime', () => ({
  config: {
    featureToggles: { grafanaAdvisor: true },
  },
}));

const mockUseListCheckQuery = jest.fn();
jest.mock('@grafana/api-clients/rtkq/advisor/v0alpha1', () => ({
  useListCheckQuery: (...args: unknown[]) => mockUseListCheckQuery(...args),
}));

const makeCheck = (overrides: Partial<Check> = {}): Check => ({
  apiVersion: 'advisor.grafana.app/v0alpha1',
  kind: 'Check',
  metadata: {
    name: 'check-1',
    creationTimestamp: '2024-01-01T00:00:00Z',
    labels: { 'advisor.grafana.app/type': 'datasource' },
    annotations: {},
    ...overrides.metadata,
  },
  spec: overrides.spec ?? {},
  status: overrides.status,
});

describe('findLatestDatasourceCheck', () => {
  it('should return undefined when items is empty', () => {
    expect(findLatestDatasourceCheck([])).toBeUndefined();
  });

  it('should return undefined when no datasource checks exist', () => {
    const items = [
      makeCheck({
        metadata: {
          name: 'c1',
          labels: { 'advisor.grafana.app/type': 'plugin' },
          creationTimestamp: '2024-01-01T00:00:00Z',
          annotations: {},
        },
      }),
    ];
    expect(findLatestDatasourceCheck(items)).toBeUndefined();
  });

  it('should return the only datasource check', () => {
    const check = makeCheck({
      metadata: {
        name: 'ds-check',
        labels: { 'advisor.grafana.app/type': 'datasource' },
        creationTimestamp: '2024-01-01T00:00:00Z',
        annotations: {},
      },
    });
    expect(findLatestDatasourceCheck([check])).toBe(check);
  });

  it('should return the latest datasource check by creationTimestamp', () => {
    const older = makeCheck({
      metadata: {
        name: 'old',
        labels: { 'advisor.grafana.app/type': 'datasource' },
        creationTimestamp: '2024-01-01T00:00:00Z',
        annotations: {},
      },
    });
    const newer = makeCheck({
      metadata: {
        name: 'new',
        labels: { 'advisor.grafana.app/type': 'datasource' },
        creationTimestamp: '2024-06-01T00:00:00Z',
        annotations: {},
      },
    });
    expect(findLatestDatasourceCheck([older, newer])).toBe(newer);
    // Order shouldn't matter
    expect(findLatestDatasourceCheck([newer, older])).toBe(newer);
  });

  it('should ignore non-datasource checks when finding latest', () => {
    const plugin = makeCheck({
      metadata: {
        name: 'plugin',
        labels: { 'advisor.grafana.app/type': 'plugin' },
        creationTimestamp: '2025-01-01T00:00:00Z',
        annotations: {},
      },
    });
    const ds = makeCheck({
      metadata: {
        name: 'ds',
        labels: { 'advisor.grafana.app/type': 'datasource' },
        creationTimestamp: '2024-01-01T00:00:00Z',
        annotations: {},
      },
    });
    expect(findLatestDatasourceCheck([plugin, ds])).toBe(ds);
  });
});

describe('useAdvisorHealthStatus', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('returns unhealthy datasource uids from the latest processed datasource check', () => {
    mockUseListCheckQuery.mockReturnValue({
      data: {
        items: [
          makeCheck({
            metadata: {
              name: 'ds-check',
              labels: { 'advisor.grafana.app/type': 'datasource' },
              creationTimestamp: '2024-06-01T00:00:00Z',
              annotations: { 'advisor.grafana.app/status': 'processed' },
            },
            status: {
              report: {
                failures: [{ item: 'ds-1', itemID: 'ds-1', severity: 'high', stepID: 'step1', links: [] }],
                count: 1,
              },
            },
          }),
        ],
      },
      isLoading: false,
      isError: false,
    });

    const { result } = renderHook(() => useAdvisorHealthStatus());

    expect(result.current.isAvailable).toBe(true);
    expect(result.current.healthMap.get('ds-1')).toBe('unhealthy');
    expect(result.current.lastChecked).toBe('2024-06-01T00:00:00Z');
  });
});

describe('getEffectiveAdvisorHealthMap', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  const checkTimestamp = '2024-06-01T00:00:00Z';
  const advisorHealthMap = new Map([
    ['ds-1', 'unhealthy' as const],
    ['ds-2', 'unhealthy' as const],
  ]);

  it('should exclude dismissed DS when test timestamp > check timestamp', () => {
    const effectiveHealthMap = getEffectiveAdvisorHealthMap(
      advisorHealthMap,
      checkTimestamp,
      new Map([['ds-1', '2024-07-01T00:00:00Z']])
    );

    expect(effectiveHealthMap.has('ds-1')).toBe(false);
    expect(effectiveHealthMap.has('ds-2')).toBe(true);
  });

  it('should keep dismissed DS when test timestamp < check timestamp', () => {
    const effectiveHealthMap = getEffectiveAdvisorHealthMap(
      advisorHealthMap,
      checkTimestamp,
      new Map([['ds-1', '2024-01-01T00:00:00Z']])
    );

    expect(effectiveHealthMap.has('ds-1')).toBe(true);
  });

  it('should not affect non-dismissed datasources', () => {
    const effectiveHealthMap = getEffectiveAdvisorHealthMap(advisorHealthMap, checkTimestamp, new Map());

    expect(effectiveHealthMap.has('ds-1')).toBe(true);
    expect(effectiveHealthMap.has('ds-2')).toBe(true);
  });

  it('should return a cloned map when there are no manual successes', () => {
    const effectiveHealthMap = getEffectiveAdvisorHealthMap(advisorHealthMap, checkTimestamp);

    expect(effectiveHealthMap).not.toBe(advisorHealthMap);
    expect(effectiveHealthMap).toEqual(advisorHealthMap);
  });
});
