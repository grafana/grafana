import { renderHook, act } from '@testing-library/react';
import { type ReactNode } from 'react';

import {
  type Check,
  type CheckList,
  type CheckType,
  useGetCheckTypeQuery,
} from '@grafana/api-clients/rtkq/advisor/v0alpha1';
import { PluginExtensionPoints } from '@grafana/data/types';
import { config, usePluginFunctions } from '@grafana/runtime';

import {
  AdvisorCheckProvider,
  useCreateDatasourceAdvisorChecks,
  useDatasourceFailureByUID,
  useLatestDatasourceCheck,
  useRetryDatasourceAdvisorCheck,
} from './useDatasourceAdvisorChecks';

jest.mock('@grafana/api-clients/rtkq/advisor/v0alpha1', () => ({
  ...jest.requireActual('@grafana/api-clients/rtkq/advisor/v0alpha1'),
  useGetCheckTypeQuery: jest.fn(),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  usePluginFunctions: jest.fn(),
}));

const useGetCheckTypeMock = useGetCheckTypeQuery as jest.Mock;
const usePluginFunctionsMock = usePluginFunctions as jest.Mock;

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

function mockPluginFunctions(options: {
  completedCheck?: Check;
  completedChecksLoading?: boolean;
  retryCheckFn?: jest.Mock;
  createChecksFn?: jest.Mock;
  createChecksLoading?: boolean;
  includeCreateChecksFn?: boolean;
  pluginLoading?: boolean;
}) {
  const {
    completedCheck,
    completedChecksLoading = false,
    retryCheckFn,
    createChecksFn,
    createChecksLoading = false,
    includeCreateChecksFn = true,
    pluginLoading = false,
  } = options;

  // Pre-create stable return objects to avoid infinite re-render loops.
  // In production, RTK Query hooks return referentially stable values;
  // the mock must do the same for useLayoutEffect deps to stabilize.
  const stableRetryCheck = retryCheckFn ?? jest.fn();
  const stableCreateChecks = createChecksFn ?? jest.fn();
  const completedData: CheckList | undefined = completedCheck
    ? { apiVersion: 'advisor.grafana.app/v0alpha1', kind: 'CheckList', items: [completedCheck], metadata: {} }
    : undefined;
  const completedResult = {
    isCompleted: !completedChecksLoading,
    isLoading: completedChecksLoading,
    data: completedData,
  };
  const retryResult = { retryCheck: stableRetryCheck };
  const createChecksResult = {
    createChecks: stableCreateChecks,
    createCheckState: { isLoading: createChecksLoading },
  };

  usePluginFunctionsMock.mockImplementation(({ extensionPointId }: { extensionPointId: string }) => {
    if (extensionPointId === PluginExtensionPoints.AdvisorCompletedChecks) {
      return {
        isLoading: pluginLoading,
        functions: pluginLoading ? [] : [{ pluginId: 'grafana-advisor-app', fn: () => completedResult }],
      };
    }
    if (extensionPointId === PluginExtensionPoints.AdvisorRetryCheck) {
      return {
        isLoading: pluginLoading,
        functions: pluginLoading ? [] : [{ pluginId: 'grafana-advisor-app', fn: () => retryResult }],
      };
    }
    if (extensionPointId === PluginExtensionPoints.AdvisorCreateChecks) {
      return {
        isLoading: pluginLoading,
        functions:
          pluginLoading || !includeCreateChecksFn
            ? []
            : [{ pluginId: 'grafana-advisor-app', fn: () => createChecksResult }],
      };
    }
    return { isLoading: false, functions: [] };
  });
}

function wrapper({ children }: { children: ReactNode }) {
  return <AdvisorCheckProvider>{children}</AdvisorCheckProvider>;
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

  it('returns isLoading false when grafanaAdvisor feature toggle is off', () => {
    config.featureToggles = { ...originalFeatureToggles, grafanaAdvisor: false };
    mockPluginFunctions({});

    const { result } = renderHook(() => useLatestDatasourceCheck(), { wrapper });

    expect(result.current.check).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
  });

  it('returns undefined when there is no check', () => {
    mockPluginFunctions({});

    const { result } = renderHook(() => useLatestDatasourceCheck(), { wrapper });

    expect(result.current.check).toBeUndefined();
  });

  it('returns the check from the plugin function', () => {
    const check = makeCheck({ name: 'latest', creationTimestamp: '2026-03-11T13:00:00Z', failures: emptyReport });

    mockPluginFunctions({ completedCheck: check });

    const { result } = renderHook(() => useLatestDatasourceCheck(), { wrapper });

    expect(result.current.check?.metadata.name).toBe('latest');
  });

  it('returns isLoading true while plugin function is loading', () => {
    mockPluginFunctions({ pluginLoading: true });

    const { result } = renderHook(() => useLatestDatasourceCheck(), { wrapper });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.check).toBeUndefined();
  });

  it('returns isLoading true while completed checks data is loading', () => {
    mockPluginFunctions({ completedChecksLoading: true });

    const { result } = renderHook(() => useLatestDatasourceCheck(), { wrapper });

    expect(result.current.isLoading).toBe(true);
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

  it('returns empty map when there is no check', () => {
    mockPluginFunctions({});

    const { result } = renderHook(() => useDatasourceFailureByUID(), { wrapper });

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

    mockPluginFunctions({ completedCheck: check });

    const { result } = renderHook(() => useDatasourceFailureByUID(), { wrapper });

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

    mockPluginFunctions({ completedCheck: check });

    const { result } = renderHook(() => useDatasourceFailureByUID(), { wrapper });

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

    mockPluginFunctions({ completedCheck: check });

    const { result } = renderHook(() => useDatasourceFailureByUID(), { wrapper });

    expect(result.current.datasourceFailureByUID.size).toBe(0);
  });

  it('returns empty map when advisor is disabled', () => {
    config.featureToggles = { ...originalFeatureToggles, grafanaAdvisor: false };
    mockPluginFunctions({});

    const { result } = renderHook(() => useDatasourceFailureByUID(), { wrapper });

    expect(result.current.datasourceFailureByUID.size).toBe(0);
    expect(result.current.isLoading).toBe(false);
  });

  it('returns empty map when latest check has no report', () => {
    const latestWithoutReport = makeCheck({ name: 'newest', creationTimestamp: '2026-04-01T00:00:00Z' });

    mockPluginFunctions({ completedCheck: latestWithoutReport });
    useGetCheckTypeMock.mockReturnValue({
      data: makeCheckType(),
      isLoading: false,
    });

    const { result } = renderHook(() => useDatasourceFailureByUID(), { wrapper });

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

    mockPluginFunctions({ completedCheck: check });
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

    const { result } = renderHook(() => useDatasourceFailureByUID(), { wrapper });

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

  it('calls retryCheck with the correct check name and datasource UID', async () => {
    const retryCheckFn = jest.fn();
    const check = makeCheck({ name: 'check-sk5fn', failures: emptyReport });
    mockPluginFunctions({ completedCheck: check, retryCheckFn });

    const { result } = renderHook(() => useRetryDatasourceAdvisorCheck(), { wrapper });

    await act(async () => {
      await result.current('P7DC3E4760CFAC4AF');
    });

    expect(retryCheckFn).toHaveBeenCalledWith('check-sk5fn', 'P7DC3E4760CFAC4AF');
  });

  it('does not call retryCheck when advisor is disabled', async () => {
    config.featureToggles = { ...originalFeatureToggles, grafanaAdvisor: false };

    const retryCheckFn = jest.fn();
    const check = makeCheck({ name: 'check-sk5fn', failures: emptyReport });
    mockPluginFunctions({ completedCheck: check, retryCheckFn });

    const { result } = renderHook(() => useRetryDatasourceAdvisorCheck(), { wrapper });

    await act(async () => {
      await result.current('some-uid');
    });

    expect(retryCheckFn).not.toHaveBeenCalled();
  });

  it('does not call retryCheck when no latest check exists', async () => {
    const retryCheckFn = jest.fn();
    mockPluginFunctions({ retryCheckFn });

    const { result } = renderHook(() => useRetryDatasourceAdvisorCheck(), { wrapper });

    await act(async () => {
      await result.current('some-uid');
    });

    expect(retryCheckFn).not.toHaveBeenCalled();
  });
});

describe('useCreateDatasourceAdvisorChecks', () => {
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

  it('calls createChecks when advisor is enabled', () => {
    const createChecksFn = jest.fn();
    mockPluginFunctions({ createChecksFn });

    const { result } = renderHook(() => useCreateDatasourceAdvisorChecks(), { wrapper });
    act(() => {
      result.current.createChecks();
    });

    expect(createChecksFn).toHaveBeenCalledTimes(1);
  });

  it('does not call createChecks when advisor is disabled', () => {
    config.featureToggles = { ...originalFeatureToggles, grafanaAdvisor: false };
    const createChecksFn = jest.fn();
    mockPluginFunctions({ createChecksFn });

    const { result } = renderHook(() => useCreateDatasourceAdvisorChecks(), { wrapper });
    act(() => {
      result.current.createChecks();
    });

    expect(createChecksFn).not.toHaveBeenCalled();
  });

  it('returns running state while create checks are running', () => {
    mockPluginFunctions({ createChecksLoading: true });

    const { result } = renderHook(() => useCreateDatasourceAdvisorChecks(), { wrapper });

    expect(result.current.isCreatingChecks).toBe(true);
  });

  it('returns running state while completed checks are still processing', () => {
    mockPluginFunctions({ completedChecksLoading: true });

    const { result } = renderHook(() => useCreateDatasourceAdvisorChecks(), { wrapper });

    expect(result.current.isCreatingChecks).toBe(true);
  });

  it('keeps advisor checks available when create checks function is not exposed', () => {
    const check = makeCheck({ name: 'latest', creationTimestamp: '2026-03-11T13:00:00Z', failures: emptyReport });
    mockPluginFunctions({ completedCheck: check, includeCreateChecksFn: false });

    const latestCheckResult = renderHook(() => useLatestDatasourceCheck(), { wrapper });
    const createResult = renderHook(() => useCreateDatasourceAdvisorChecks(), { wrapper });

    expect(latestCheckResult.result.current.check?.metadata.name).toBe('latest');
    expect(latestCheckResult.result.current.isLoading).toBe(false);
    expect(createResult.result.current.isAvailable).toBe(false);
  });
});
