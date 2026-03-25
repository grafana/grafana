import { renderHook } from '@testing-library/react';

import { Check, CheckType, useGetCheckTypeQuery, useListCheckQuery } from '@grafana/api-clients/rtkq/advisor/v0alpha1';
import { config } from '@grafana/runtime';

import { useDatasourceFailureByUID, useLatestDatasourceCheck } from './useDatasourceAdvisorChecks';

jest.mock('@grafana/api-clients/rtkq/advisor/v0alpha1', () => ({
  ...jest.requireActual('@grafana/api-clients/rtkq/advisor/v0alpha1'),
  useListCheckQuery: jest.fn(),
  useGetCheckTypeQuery: jest.fn(),
}));

const useListCheckMock = useListCheckQuery as jest.Mock;
const useGetCheckTypeMock = useGetCheckTypeQuery as jest.Mock;

function makeCheck(overrides: { name?: string; creationTimestamp?: string; failures?: Check['status'] }): Check {
  return {
    apiVersion: 'advisor.grafana.app/v0alpha1',
    kind: 'Check',
    metadata: {
      name: overrides.name ?? 'check-1',
      creationTimestamp: overrides.creationTimestamp ?? '2026-01-01T00:00:00Z',
      labels: { 'advisor.grafana.app/type': 'datasource' },
    },
    spec: {},
    status: overrides.failures,
  };
}

function makeCheckType(
  overrides: {
    name?: string;
    steps?: CheckType['spec']['steps'];
  } = {}
): CheckType {
  return {
    apiVersion: 'advisor.grafana.app/v0alpha1',
    kind: 'CheckType',
    metadata: {
      name: overrides.name ?? 'datasource',
    },
    spec: {
      name: overrides.name ?? 'datasource',
      steps: overrides.steps ?? [
        {
          title: 'Health check',
          description: 'Checks if datasource is healthy',
          stepID: 'health-check',
          resolution: 'Open datasource settings and address reported issues.',
        },
      ],
    },
  };
}

describe('useLatestDatasourceCheck', () => {
  const originalFeatureToggles = config.featureToggles;

  beforeEach(() => {
    jest.clearAllMocks();
    config.featureToggles = {
      ...originalFeatureToggles,
      grafanaAdvisor: true,
      advisorDatasourceIntegration: true,
    };
    useGetCheckTypeMock.mockReturnValue({ data: undefined, isLoading: false });
  });

  afterEach(() => {
    config.featureToggles = originalFeatureToggles;
  });

  it('skips the query when grafanaAdvisor feature toggle is off', () => {
    config.featureToggles = { ...originalFeatureToggles, grafanaAdvisor: false };
    useListCheckMock.mockReturnValue({ data: undefined, isLoading: false });

    const { result } = renderHook(() => useLatestDatasourceCheck());

    expect(useListCheckMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ skip: true }));
    expect(result.current.check).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
  });

  it('returns undefined when there are no items', () => {
    useListCheckMock.mockReturnValue({ data: { items: [] }, isLoading: false });

    const { result } = renderHook(() => useLatestDatasourceCheck());

    expect(result.current.check).toBeUndefined();
  });

  it('returns the latest check by creationTimestamp', () => {
    const older = makeCheck({ name: 'older', creationTimestamp: '2026-01-01T00:00:00Z' });
    const newer = makeCheck({ name: 'newer', creationTimestamp: '2026-03-11T13:00:00Z' });

    useListCheckMock.mockReturnValue({ data: { items: [newer, older] }, isLoading: false });

    const { result } = renderHook(() => useLatestDatasourceCheck());

    expect(result.current.check?.metadata.name).toBe('newer');
  });

  it('passes the correct labelSelector and limit', () => {
    useListCheckMock.mockReturnValue({ data: undefined, isLoading: false });

    renderHook(() => useLatestDatasourceCheck());

    expect(useListCheckMock).toHaveBeenCalledWith(
      { labelSelector: 'advisor.grafana.app/type=datasource', limit: 1000 },
      expect.objectContaining({ skip: false })
    );
  });
});

describe('useDatasourceFailureByUID', () => {
  const originalFeatureToggles = config.featureToggles;

  beforeEach(() => {
    jest.clearAllMocks();
    config.featureToggles = {
      ...originalFeatureToggles,
      grafanaAdvisor: true,
      advisorDatasourceIntegration: true,
    };
    useGetCheckTypeMock.mockReturnValue({ data: undefined, isLoading: false });
  });

  afterEach(() => {
    config.featureToggles = originalFeatureToggles;
  });

  it('returns empty map when there are no checks', () => {
    useListCheckMock.mockReturnValue({ data: { items: [] }, isLoading: false });

    const { result } = renderHook(() => useDatasourceFailureByUID());

    expect(result.current.datasourceFailureByUID.size).toBe(0);
  });

  it('returns all datasources with any failure and their highest severity', () => {
    const check = makeCheck({
      failures: {
        report: {
          count: 5,
          failures: [
            { item: 'prometheus', itemID: 'uid-1', stepID: 'health-check', severity: 'high', links: [] },
            { item: 'loki', itemID: 'uid-2', stepID: 'health-check', severity: 'high', links: [] },
            { item: 'testdata', itemID: 'uid-3', stepID: 'uid-validation', severity: 'low', links: [] },
            { item: 'graphite', itemID: 'uid-4', stepID: 'missing-plugin', severity: 'high', links: [] },
          ],
        },
      },
    });

    useListCheckMock.mockReturnValue({ data: { items: [check] }, isLoading: false });

    const { result } = renderHook(() => useDatasourceFailureByUID());

    expect(result.current.datasourceFailureByUID.get('uid-1')?.severity).toBe('high');
    expect(result.current.datasourceFailureByUID.get('uid-2')?.severity).toBe('high');
    expect(result.current.datasourceFailureByUID.get('uid-3')?.severity).toBe('low');
    expect(result.current.datasourceFailureByUID.get('uid-4')?.severity).toBe('high');
    expect(result.current.datasourceFailureByUID.size).toBe(4);
  });

  it('returns highest severity when a datasource has multiple failures', () => {
    const check = makeCheck({
      failures: {
        report: {
          count: 3,
          failures: [
            { item: 'prometheus', itemID: 'uid-1', stepID: 'health-check', severity: 'low', links: [] },
            { item: 'prometheus', itemID: 'uid-1', stepID: 'uid-validation', severity: 'high', links: [] },
          ],
        },
      },
    });

    useListCheckMock.mockReturnValue({ data: { items: [check] }, isLoading: false });

    const { result } = renderHook(() => useDatasourceFailureByUID());

    expect(result.current.datasourceFailureByUID.get('uid-1')?.severity).toBe('high');
    expect(result.current.datasourceFailureByUID.size).toBe(1);
  });

  it('returns empty map when check has no failures', () => {
    const check = makeCheck({
      failures: {
        report: {
          count: 10,
          failures: [],
        },
      },
    });

    useListCheckMock.mockReturnValue({ data: { items: [check] }, isLoading: false });

    const { result } = renderHook(() => useDatasourceFailureByUID());

    expect(result.current.datasourceFailureByUID.size).toBe(0);
  });

  it('returns empty map when advisor is disabled', () => {
    config.featureToggles = { ...originalFeatureToggles, grafanaAdvisor: false };
    useListCheckMock.mockReturnValue({ data: undefined, isLoading: false });

    const { result } = renderHook(() => useDatasourceFailureByUID());

    expect(result.current.datasourceFailureByUID.size).toBe(0);
    expect(result.current.isLoading).toBe(false);
  });

  it('includes tooltip message from checktype step title and resolution', () => {
    const check = makeCheck({
      failures: {
        report: {
          count: 1,
          failures: [{ item: 'prometheus', itemID: 'uid-1', stepID: 'health-check', severity: 'high', links: [] }],
        },
      },
    });

    useListCheckMock.mockReturnValue({ data: { items: [check] }, isLoading: false });
    useGetCheckTypeMock.mockReturnValue({
      data: makeCheckType({
        steps: [
          {
            title: 'Health check',
            description: 'Checks if datasource is healthy',
            stepID: 'health-check',
            resolution: 'Go to datasource settings and fix the reported issue.',
          },
        ],
      }),
      isLoading: false,
    });

    const { result } = renderHook(() => useDatasourceFailureByUID());

    expect(result.current.datasourceFailureByUID.get('uid-1')?.message).toBe(
      'Health check failed: Go to datasource settings and fix the reported issue.'
    );
  });
});
