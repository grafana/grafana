import { renderHook } from '@testing-library/react';

import { type DataSourceInstanceListItem } from '@grafana/data';

import { kubernetesSolution } from './solutions/kubernetesSolution';
import { logsSolution } from './solutions/logsSolution';
import { metricsSolution } from './solutions/metricsSolution';
import { probeSpanMetrics } from './solutions/spanMetricsSignal';
import { syntheticsSolution } from './solutions/syntheticsSolution';
import { tracesSolution } from './solutions/tracesSolution';
import { type Solution, type SolutionId } from './solutions/types';
import { useHomepageSolutions } from './useHomepageSolutions';

jest.mock('./solutions/kubernetesSolution', () => ({ kubernetesSolution: jest.fn() }));
jest.mock('./solutions/logsSolution', () => ({ logsSolution: jest.fn() }));
jest.mock('./solutions/metricsSolution', () => ({ metricsSolution: jest.fn() }));
jest.mock('./solutions/tracesSolution', () => ({ tracesSolution: jest.fn() }));
jest.mock('./solutions/syntheticsSolution', () => ({ syntheticsSolution: jest.fn() }));
jest.mock('./solutions/spanMetricsSignal', () => ({ probeSpanMetrics: jest.fn() }));

const mockFactories: Record<SolutionId, jest.MockedFunction<() => Solution>> = {
  kubernetes: jest.mocked(kubernetesSolution),
  traces: jest.mocked(tracesSolution),
  metrics: jest.mocked(metricsSolution),
  logs: jest.mocked(logsSolution),
  synthetics: jest.mocked(syntheticsSolution),
};
const mockProbeSpanMetrics = jest.mocked(probeSpanMetrics);

const datasource: DataSourceInstanceListItem = {
  uid: 'prometheus',
  name: 'Prometheus',
  type: 'prometheus',
  meta: { id: 'prometheus' } as DataSourceInstanceListItem['meta'],
  readOnly: false,
  isDefault: true,
};

function solution(id: SolutionId, status: 'active' | 'inactive' | 'unknown' = 'inactive'): Solution {
  return {
    id,
    title: id,
    icon: 'chart-line',
    signal: jest.fn(async () => status),
    datasource: jest.fn(async () => (status === 'active' ? datasource : null)),
    needsAttention: jest.fn(async () => false),
    stats: jest.fn(async () => null),
    refinedStats: jest.fn(async () => null),
    sparkline: jest.fn(async () => null),
    cta: jest.fn(async () => null),
    alert: jest.fn(async () => null),
    offer: jest.fn(async () => null),
  };
}

let fixtures: Record<SolutionId, Solution>;

beforeEach(() => {
  fixtures = {
    kubernetes: solution('kubernetes', 'active'),
    traces: solution('traces', 'unknown'),
    metrics: solution('metrics', 'active'),
    logs: solution('logs', 'inactive'),
    synthetics: solution('synthetics'),
  };
  for (const id of Object.keys(mockFactories) as SolutionId[]) {
    mockFactories[id].mockReset().mockImplementation(() => fixtures[id]);
  }
  mockProbeSpanMetrics.mockReset().mockResolvedValue(datasource);
});

describe('useHomepageSolutions', () => {
  it('constructs every solution once without eagerly reading any fact', () => {
    renderHook(() => useHomepageSolutions());

    for (const id of Object.keys(mockFactories) as SolutionId[]) {
      expect(mockFactories[id]).toHaveBeenCalledTimes(1);
      for (const getter of [
        fixtures[id].signal,
        fixtures[id].datasource,
        fixtures[id].needsAttention,
        fixtures[id].stats,
        fixtures[id].refinedStats,
        fixtures[id].sparkline,
        fixtures[id].cta,
        fixtures[id].alert,
        fixtures[id].offer,
      ]) {
        expect(getter).not.toHaveBeenCalled();
      }
    }
    expect(mockProbeSpanMetrics).not.toHaveBeenCalled();
  });

  it('returns solutions in display order', () => {
    const { result } = renderHook(() => useHomepageSolutions());

    expect(result.current.solutions.map(({ id }) => id)).toEqual([
      'kubernetes',
      'metrics',
      'logs',
      'traces',
      'synthetics',
    ]);
  });

  it('keeps the registry and its solution instances stable across rerenders', () => {
    const { result, rerender } = renderHook(() => useHomepageSolutions());
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
    for (const factory of Object.values(mockFactories)) {
      expect(factory).toHaveBeenCalledTimes(1);
    }
  });

  it('assembles the cross-solution signal snapshot only when requested', async () => {
    const { result } = renderHook(() => useHomepageSolutions());

    await expect(result.current.signals()).resolves.toEqual({
      metrics: 'active',
      logs: 'inactive',
      traces: 'unknown',
      kubernetes: 'active',
      spanMetrics: 'active',
      synthetics: 'inactive',
    });
    expect(fixtures.metrics.signal).toHaveBeenCalledTimes(1);
    expect(fixtures.logs.signal).toHaveBeenCalledTimes(1);
    expect(fixtures.traces.signal).toHaveBeenCalledTimes(1);
    expect(fixtures.kubernetes.signal).toHaveBeenCalledTimes(1);
    expect(fixtures.synthetics.signal).toHaveBeenCalledTimes(1);
    expect(mockProbeSpanMetrics).toHaveBeenCalledTimes(1);
  });

  it('shares the memoized span-metrics probe between repeated snapshot reads', async () => {
    const { result } = renderHook(() => useHomepageSolutions());

    await Promise.all([result.current.signals(), result.current.signals()]);

    expect(mockProbeSpanMetrics).toHaveBeenCalledTimes(1);
  });

  it('maps a rejecting solution getter to unknown without rejecting the snapshot', async () => {
    fixtures.logs.signal = jest.fn(async () => {
      throw new Error('Loki unavailable');
    });
    const { result } = renderHook(() => useHomepageSolutions());

    await expect(result.current.signals()).resolves.toEqual(expect.objectContaining({ logs: 'unknown' }));
  });
});
