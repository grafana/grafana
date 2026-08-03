import { act, render, waitFor } from 'test/test-utils';

import { type DataSourceInstanceListItem } from '@grafana/data';
import { usePluginBridge } from 'app/features/alerting/unified/hooks/usePluginBridge';

import { useSolutionState } from './solutionState';
import { type SolutionState } from './solutionsMatrix';
import { fetchLogsActivity, fetchMetricsActivity, fetchTracesActivity, fetchTracesServices } from './telemetryData';
import { useTelemetrySolutions, type TelemetrySolutions } from './useTelemetrySolutions';

jest.mock('./solutionState', () => ({
  useSolutionState: jest.fn(),
}));

jest.mock('./telemetryData', () => ({
  ...jest.requireActual('./telemetryData'),
  fetchLogsActivity: jest.fn(),
  fetchMetricsActivity: jest.fn(),
  fetchTracesActivity: jest.fn(),
  fetchTracesServices: jest.fn(),
}));

jest.mock('app/features/alerting/unified/hooks/usePluginBridge', () => ({
  ...jest.requireActual('app/features/alerting/unified/hooks/usePluginBridge'),
  usePluginBridge: jest.fn(),
}));

const mockUseSolutionState = jest.mocked(useSolutionState);
const mockUsePluginBridge = jest.mocked(usePluginBridge);
const mockFetchLogsActivity = jest.mocked(fetchLogsActivity);
const mockFetchMetricsActivity = jest.mocked(fetchMetricsActivity);
const mockFetchTracesActivity = jest.mocked(fetchTracesActivity);
const mockFetchTracesServices = jest.mocked(fetchTracesServices);

const prometheusDatasource: DataSourceInstanceListItem = {
  uid: 'prom-uid',
  name: 'grafanacloud-prom',
  type: 'prometheus',
  meta: { id: 'prometheus' } as DataSourceInstanceListItem['meta'],
  readOnly: false,
  isDefault: false,
};

const tempoDatasource: DataSourceInstanceListItem = {
  uid: 'tempo-uid',
  name: 'grafanacloud-traces',
  type: 'tempo',
  meta: { id: 'tempo' } as DataSourceInstanceListItem['meta'],
  readOnly: false,
  isDefault: false,
};

function setSolutionState(
  overrides: Partial<SolutionState>,
  ds: {
    loki?: DataSourceInstanceListItem;
    tempo?: DataSourceInstanceListItem;
    prometheus?: DataSourceInstanceListItem;
  } = {}
) {
  mockUseSolutionState.mockReturnValue({
    value: {
      state: {
        metrics: 'inactive',
        logs: 'inactive',
        traces: 'inactive',
        kubernetes: 'inactive',
        spanMetrics: 'inactive',
        ...overrides,
      },
      lokiDatasource: ds.loki ?? null,
      tempoDatasource: ds.tempo ?? null,
      prometheusDatasource: ds.prometheus ?? null,
    },
    loading: false,
  });
}

// Frame-capture probe: the one-frame settled-empty hazard re-renders away before
// post-`act` DOM assertions could see it, so record every render's hook result instead.
const frames: TelemetrySolutions[] = [];
function Probe() {
  frames.push(useTelemetrySolutions());
  return null;
}

beforeEach(() => {
  frames.length = 0;
  mockUseSolutionState.mockReset();
  setSolutionState({});
  mockUsePluginBridge.mockReturnValue({ loading: false, installed: false, settings: undefined });
  mockFetchMetricsActivity.mockReset();
  mockFetchMetricsActivity.mockResolvedValue({
    series: null,
    dataPointsPerMinute: null,
    names: null,
    hosts: null,
    seriesSparkline: null,
    disk: null,
  });
  mockFetchLogsActivity.mockReset();
  mockFetchLogsActivity.mockResolvedValue({ bytes: null, sources: null, series: null });
  mockFetchTracesActivity.mockReset();
  mockFetchTracesActivity.mockResolvedValue({ spans: null, series: null });
  mockFetchTracesServices.mockReset();
  mockFetchTracesServices.mockResolvedValue(null);
});

describe('useTelemetrySolutions', () => {
  it('never reports settled-empty on the render where a signal flips active', async () => {
    mockUseSolutionState.mockReturnValue({ value: undefined, loading: true });
    mockFetchMetricsActivity.mockReturnValue(new Promise<never>(() => {}));

    const { rerender } = render(<Probe />);
    // Let the disabled useAsync run settle `undefined`.
    await act(async () => {});

    setSolutionState({ metrics: 'active' }, { prometheus: prometheusDatasource });
    rerender(<Probe />);
    await act(async () => {});

    // The fetch never settles, so every captured frame must still read as loading —
    // including the flip frame, where useAsync still exposes the disabled run's settle.
    expect(frames.length).toBeGreaterThan(0);
    expect(frames.every((f) => f.metrics.loading)).toBe(true);
    expect(frames.every((f) => f.metrics.item === null)).toBe(true);
  });

  it('settles with the item once the fetch resolves', async () => {
    setSolutionState({ metrics: 'active' }, { prometheus: prometheusDatasource });
    mockFetchMetricsActivity.mockResolvedValue({
      series: 4_200_000,
      dataPointsPerMinute: null,
      names: null,
      hosts: null,
      seriesSparkline: null,
      disk: null,
    });

    render(<Probe />);

    await waitFor(() => {
      const last = frames[frames.length - 1];
      expect(last?.metrics.loading).toBe(false);
      expect(last?.metrics.item).not.toBeNull();
    });
  });

  it('fails closed when a detail fetch rejects', async () => {
    setSolutionState({ traces: 'active' }, { tempo: tempoDatasource });
    mockFetchTracesActivity.mockRejectedValue(new Error('tempo down'));
    mockFetchTracesServices.mockResolvedValue(3);

    render(<Probe />);

    await waitFor(() => {
      const last = frames[frames.length - 1];
      expect(last?.traces.loading).toBe(false);
      expect(last?.traces.item).toBeNull();
    });
  });

  it('ships the traces card without waiting for the services count', async () => {
    setSolutionState({ traces: 'active' }, { tempo: tempoDatasource });
    mockFetchTracesActivity.mockResolvedValue({ spans: 4_800_000, series: null });
    mockFetchTracesServices.mockReturnValue(new Promise<never>(() => {}));

    render(<Probe />);

    await waitFor(() => {
      const last = frames[frames.length - 1];
      expect(last?.traces.loading).toBe(false);
      expect(last?.traces.item).not.toBeNull();
      expect(last?.traces.item?.stats?.secondary).toBe('traced · 24h');
    });
  });
});
