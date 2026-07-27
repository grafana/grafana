import { act, renderHook, waitFor } from '@testing-library/react';

import { type PluginMeta } from '@grafana/data';
import { canAccessPluginPage, usePluginBridge } from 'app/features/alerting/unified/hooks/usePluginBridge';

import {
  fetchMetricsHistory,
  fetchMetricsOverview,
  METRICS_DRILLDOWN_APP_ID,
  type MetricsOverview,
} from './metricsData';
import { useMetricsSolution } from './useMetricsSolution';

jest.mock('app/features/alerting/unified/hooks/usePluginBridge', () => ({
  ...jest.requireActual('app/features/alerting/unified/hooks/usePluginBridge'),
  canAccessPluginPage: jest.fn(),
  usePluginBridge: jest.fn(),
}));

jest.mock('./metricsData', () => ({
  ...jest.requireActual('./metricsData'),
  fetchMetricsHistory: jest.fn(),
  fetchMetricsOverview: jest.fn(),
}));

const mockCanAccessPluginPage = jest.mocked(canAccessPluginPage);
const mockUsePluginBridge = jest.mocked(usePluginBridge);
const mockFetchMetricsOverview = jest.mocked(fetchMetricsOverview);
const mockFetchMetricsHistory = jest.mocked(fetchMetricsHistory);

const settings = { id: METRICS_DRILLDOWN_APP_ID } as PluginMeta;
const overview: MetricsOverview = {
  activeSeries: 4_200_000,
  dataPointsPerMinute: 5_160_000,
  queries: {
    datasourceUid: 'prometheus',
    activeSeries: 'sum(prometheus_tsdb_head_series)',
    dataPointsPerMinute: '60 * sum(rate(prometheus_tsdb_head_samples_appended_total[5m]))',
  },
};

beforeEach(() => {
  mockCanAccessPluginPage.mockReturnValue(true);
  mockUsePluginBridge.mockReturnValue({ loading: false, installed: true, settings });
  mockFetchMetricsOverview.mockResolvedValue(null);
  mockFetchMetricsHistory.mockResolvedValue(null);
});

afterEach(() => jest.restoreAllMocks());

describe('useMetricsSolution', () => {
  it('reports bridge loading without querying metrics', async () => {
    mockUsePluginBridge.mockReturnValue({ loading: true, installed: undefined, settings: undefined });

    const { result } = renderHook(() => useMetricsSolution());
    await act(async () => {});

    expect(result.current).toEqual({ loading: true, item: null });
    expect(mockFetchMetricsOverview).not.toHaveBeenCalled();
  });

  it('settles empty without querying when the app is unavailable or inaccessible', async () => {
    mockCanAccessPluginPage.mockReturnValue(false);

    const { result } = renderHook(() => useMetricsSolution());
    await act(async () => {});

    expect(result.current).toEqual({ loading: false, item: null });
    expect(mockFetchMetricsOverview).not.toHaveBeenCalled();
  });

  it('reports loading while the overview is pending', async () => {
    mockFetchMetricsOverview.mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() => useMetricsSolution());

    await waitFor(() => expect(mockFetchMetricsOverview).toHaveBeenCalledTimes(1));
    expect(result.current).toEqual({ loading: true, item: null });
    expect(mockFetchMetricsHistory).not.toHaveBeenCalled();
  });

  it('settles empty without fetching history when the overview has no active series', async () => {
    const { result } = renderHook(() => useMetricsSolution());

    await waitFor(() => expect(result.current).toEqual({ loading: false, item: null }));
    expect(mockFetchMetricsHistory).not.toHaveBeenCalled();
  });

  it('settles empty when the overview query rejects', async () => {
    mockFetchMetricsOverview.mockRejectedValue(new Error('query failed'));

    const { result } = renderHook(() => useMetricsSolution());

    await waitFor(() => expect(result.current).toEqual({ loading: false, item: null }));
    expect(mockFetchMetricsHistory).not.toHaveBeenCalled();
  });

  it('keeps the Metrics card when history rejects, removing only the sparkline loading state', async () => {
    let rejectHistory: (error: Error) => void = () => {};
    mockFetchMetricsOverview.mockResolvedValue(overview);
    mockFetchMetricsHistory.mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectHistory = reject;
        })
    );

    const { result } = renderHook(() => useMetricsSolution());

    await waitFor(() => expect(result.current.item?.sparklineLoading).toBe(true));
    expect(result.current).toMatchObject({
      loading: false,
      item: {
        id: 'metrics',
        sparkline: undefined,
      },
    });

    act(() => rejectHistory(new Error('history failed')));

    await waitFor(() => expect(result.current.item?.sparklineLoading).toBe(false));
    expect(result.current.item?.id).toBe('metrics');
    expect(result.current.item?.sparkline).toBeUndefined();
  });
});
