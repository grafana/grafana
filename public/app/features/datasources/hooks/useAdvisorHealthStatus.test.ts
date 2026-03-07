import type { Check } from '@grafana/api-clients/rtkq/advisor/v0alpha1';

import { findLatestDatasourceCheck } from './useAdvisorHealthStatus';

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
