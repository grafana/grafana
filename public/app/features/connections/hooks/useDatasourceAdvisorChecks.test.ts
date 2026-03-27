import { renderHook, act } from '@testing-library/react';

import {
  Check,
  CheckType,
  useGetCheckTypeQuery,
  useListCheckQuery,
  useUpdateCheckMutation,
} from '@grafana/api-clients/rtkq/advisor/v0alpha1';
import { config } from '@grafana/runtime';

import {
  useDatasourceFailureByUID,
  useLatestDatasourceCheck,
  useRetryDatasourceAdvisorCheck,
} from './useDatasourceAdvisorChecks';

jest.mock('@grafana/api-clients/rtkq/advisor/v0alpha1', () => ({
  ...jest.requireActual('@grafana/api-clients/rtkq/advisor/v0alpha1'),
  useListCheckQuery: jest.fn(),
  useUpdateCheckMutation: jest.fn(),
  useGetCheckTypeQuery: jest.fn(),
}));

const useListCheckMock = useListCheckQuery as jest.Mock;
const useUpdateCheckMutationMock = useUpdateCheckMutation as jest.Mock;
const useGetCheckTypeMock = useGetCheckTypeQuery as jest.Mock;

const emptyReport: Check['status'] = {
  report: {
    count: 0,
    failures: [],
  },
};

function makeCheck(overrides: {
  name?: string;
  creationTimestamp?: string;
  resourceVersion?: string;
  annotations?: Record<string, string>;
  failures?: Check['status'];
}): Check {
  return {
    apiVersion: 'advisor.grafana.app/v0alpha1',
    kind: 'Check',
    metadata: {
      name: overrides.name ?? 'check-1',
      creationTimestamp: overrides.creationTimestamp ?? '2026-01-01T00:00:00Z',
      resourceVersion: overrides.resourceVersion,
      annotations: overrides.annotations,
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
    useUpdateCheckMutationMock.mockReturnValue([jest.fn(), {}]);
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

  it('returns a refetch callback from the query hook', async () => {
    const refetch = jest.fn();
    useListCheckMock.mockReturnValue({ data: { items: [] }, isLoading: false, refetch });

    const { result } = renderHook(() => useLatestDatasourceCheck());

    await act(async () => {
      result.current.refetchLatestCheck();
    });

    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('refetches on interval while latest check has retry annotation', () => {
    jest.useFakeTimers();
    const refetch = jest.fn();
    const pendingCheck = makeCheck({
      name: 'pending',
      creationTimestamp: '2026-03-11T13:00:00Z',
      annotations: { 'advisor.grafana.app/retry': 'uid-1' },
      failures: emptyReport,
    });
    useListCheckMock.mockReturnValue({ data: { items: [pendingCheck] }, isLoading: false, refetch });

    renderHook(() => useLatestDatasourceCheck());

    act(() => {
      jest.advanceTimersByTime(4000);
    });

    expect(refetch).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  it('refetches on interval when status annotation is missing', () => {
    jest.useFakeTimers();
    const refetch = jest.fn();
    const checkWithoutStatus = makeCheck({
      name: 'pending-without-status',
      creationTimestamp: '2026-03-11T13:00:00Z',
      failures: emptyReport,
    });
    useListCheckMock.mockReturnValue({ data: { items: [checkWithoutStatus] }, isLoading: false, refetch });

    renderHook(() => useLatestDatasourceCheck());

    act(() => {
      jest.advanceTimersByTime(4000);
    });

    expect(refetch).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  it('does not refetch on interval when check status is error', () => {
    jest.useFakeTimers();
    const refetch = jest.fn();
    const completedCheck = makeCheck({
      name: 'completed',
      creationTimestamp: '2026-03-11T13:00:00Z',
      annotations: {
        'advisor.grafana.app/retry': '',
        'advisor.grafana.app/status': 'error',
      },
      failures: emptyReport,
    });
    useListCheckMock.mockReturnValue({ data: { items: [completedCheck] }, isLoading: false, refetch });

    renderHook(() => useLatestDatasourceCheck());

    act(() => {
      jest.advanceTimersByTime(4000);
    });

    expect(refetch).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('does not refetch on interval when retry annotation is an empty string', () => {
    jest.useFakeTimers();
    const refetch = jest.fn();
    const completedCheck = makeCheck({
      name: 'completed-empty-retry',
      creationTimestamp: '2026-03-11T13:00:00Z',
      annotations: {
        'advisor.grafana.app/retry': '   ',
        'advisor.grafana.app/status': 'ok',
      },
      failures: emptyReport,
    });
    useListCheckMock.mockReturnValue({ data: { items: [completedCheck] }, isLoading: false, refetch });

    renderHook(() => useLatestDatasourceCheck());

    act(() => {
      jest.advanceTimersByTime(4000);
    });

    expect(refetch).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('returns the latest check by creationTimestamp', () => {
    const older = makeCheck({ name: 'older', creationTimestamp: '2026-01-01T00:00:00Z', failures: emptyReport });
    const newer = makeCheck({ name: 'newer', creationTimestamp: '2026-03-11T13:00:00Z', failures: emptyReport });

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
    useUpdateCheckMutationMock.mockReturnValue([jest.fn(), {}]);
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

  it('returns latest check even when newest has no report yet', () => {
    const latestWithoutReport = makeCheck({ name: 'newest', creationTimestamp: '2026-04-01T00:00:00Z' });
    const latestWithReport = makeCheck({
      name: 'latest-with-report',
      creationTimestamp: '2026-03-31T00:00:00Z',
      failures: {
        report: {
          count: 1,
          failures: [{ item: 'prometheus', itemID: 'uid-1', stepID: 'health-check', severity: 'high', links: [] }],
        },
      },
    });

    useListCheckMock.mockReturnValue({ data: { items: [latestWithoutReport, latestWithReport] }, isLoading: false });
    useGetCheckTypeMock.mockReturnValue({
      data: makeCheckType(),
      isLoading: false,
    });

    const { result } = renderHook(() => useDatasourceFailureByUID());

    expect(result.current.datasourceFailureByUID.size).toBe(0);
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

describe('useRetryDatasourceAdvisorCheck', () => {
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

  it('sends a patch with the correct check name, path and datasource UID', async () => {
    const check = makeCheck({ name: 'check-sk5fn', failures: emptyReport });
    useListCheckMock.mockReturnValue({ data: { items: [check] }, isLoading: false });

    const updateCheckFn = jest.fn().mockReturnValue({ unwrap: () => Promise.resolve() });
    useUpdateCheckMutationMock.mockReturnValue([updateCheckFn, {}]);

    const { result } = renderHook(() => useRetryDatasourceAdvisorCheck());

    await act(async () => {
      await result.current('P7DC3E4760CFAC4AF');
    });

    expect(updateCheckFn).toHaveBeenCalledWith({
      name: 'check-sk5fn',
      patch: [
        {
          op: 'add',
          path: '/metadata/annotations/advisor.grafana.app~1retry',
          value: 'P7DC3E4760CFAC4AF',
        },
      ],
    });
  });

  it('does not send a patch when advisor is disabled', async () => {
    config.featureToggles = { ...originalFeatureToggles, grafanaAdvisor: false };

    const check = makeCheck({ name: 'check-sk5fn', failures: emptyReport });
    useListCheckMock.mockReturnValue({ data: { items: [check] }, isLoading: false });

    const updateCheckFn = jest.fn().mockReturnValue({ unwrap: () => Promise.resolve() });
    useUpdateCheckMutationMock.mockReturnValue([updateCheckFn, {}]);

    const { result } = renderHook(() => useRetryDatasourceAdvisorCheck());

    await act(async () => {
      await result.current('some-uid');
    });

    expect(updateCheckFn).not.toHaveBeenCalled();
  });

  it('does not send a patch when no latest check exists', async () => {
    useListCheckMock.mockReturnValue({ data: { items: [] }, isLoading: false });

    const updateCheckFn = jest.fn().mockReturnValue({ unwrap: () => Promise.resolve() });
    useUpdateCheckMutationMock.mockReturnValue([updateCheckFn, {}]);

    const { result } = renderHook(() => useRetryDatasourceAdvisorCheck());

    await act(async () => {
      await result.current('some-uid');
    });

    expect(updateCheckFn).not.toHaveBeenCalled();
  });
});
