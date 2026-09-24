import { act, renderHook } from '@testing-library/react';

import { type DataSourceInstanceListItem, store } from '@grafana/data';

import { detectIrmSignal } from './solutions/irmSignal';
import { kubernetesDetection, kubernetesSolution } from './solutions/kubernetesSolution';
import { logsSolution } from './solutions/logsSolution';
import { metricsDetection, metricsSolution } from './solutions/metricsSolution';
import { solutionFilterStorageKey } from './solutions/solutionFilter';
import { probeSpanMetrics } from './solutions/spanMetricsSignal';
import { syntheticsSolution } from './solutions/syntheticsSolution';
import { tracesSolution } from './solutions/tracesSolution';
import { type Solution, type SolutionId } from './solutions/types';
import { useHomepageSolutions } from './useHomepageSolutions';

jest.mock('./solutions/kubernetesSolution', () => ({ kubernetesSolution: jest.fn(), kubernetesDetection: jest.fn() }));
jest.mock('./solutions/logsSolution', () => ({ logsSolution: jest.fn() }));
jest.mock('./solutions/metricsSolution', () => ({ metricsSolution: jest.fn(), metricsDetection: jest.fn() }));
jest.mock('./solutions/tracesSolution', () => ({ tracesSolution: jest.fn() }));
jest.mock('./solutions/syntheticsSolution', () => ({ syntheticsSolution: jest.fn() }));
jest.mock('./solutions/spanMetricsSignal', () => ({ probeSpanMetrics: jest.fn() }));
jest.mock('./solutions/irmSignal', () => ({ detectIrmSignal: jest.fn() }));

// `satisfies` keeps every solution present; `jest.mocked` keeps each factory's own signature.
const mockFactories = jest.mocked({
  kubernetes: kubernetesSolution,
  traces: tracesSolution,
  metrics: metricsSolution,
  logs: logsSolution,
  synthetics: syntheticsSolution,
} satisfies Record<SolutionId, (...args: never[]) => Solution>);
const mockProbeSpanMetrics = jest.mocked(probeSpanMetrics);
const mockDetectIrmSignal = jest.mocked(detectIrmSignal);

const datasource: DataSourceInstanceListItem = {
  uid: 'prometheus',
  name: 'Prometheus',
  type: 'prometheus',
  meta: { id: 'prometheus' } as DataSourceInstanceListItem['meta'],
  isDefault: true,
};
// The detections the owner hands to every filtered solution it creates.
const detectKubernetes = jest.fn(async () => ({ status: 'active' as const, datasource }));
const detectMetrics = jest.fn(async () => ({ status: 'active' as const, datasource }));

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
  window.localStorage.clear();
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
  detectKubernetes.mockClear();
  detectMetrics.mockClear();
  jest.mocked(kubernetesDetection).mockReset().mockReturnValue(detectKubernetes);
  jest.mocked(metricsDetection).mockReset().mockReturnValue(detectMetrics);
  mockProbeSpanMetrics.mockReset().mockResolvedValue(datasource);
  mockDetectIrmSignal.mockReset().mockResolvedValue('inactive');
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
    expect(mockDetectIrmSignal).not.toHaveBeenCalled();
    expect(detectKubernetes).not.toHaveBeenCalled();
    expect(detectMetrics).not.toHaveBeenCalled();
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
      irm: 'inactive',
    });
    // The filtered solutions' signals come from the shared detections, not from a solution instance.
    expect(detectMetrics).toHaveBeenCalledTimes(1);
    expect(detectKubernetes).toHaveBeenCalledTimes(1);
    expect(fixtures.metrics.signal).not.toHaveBeenCalled();
    expect(fixtures.kubernetes.signal).not.toHaveBeenCalled();
    expect(fixtures.logs.signal).toHaveBeenCalledTimes(1);
    expect(fixtures.traces.signal).toHaveBeenCalledTimes(1);
    expect(fixtures.synthetics.signal).toHaveBeenCalledTimes(1);
    expect(mockProbeSpanMetrics).toHaveBeenCalledTimes(1);
    expect(mockDetectIrmSignal).toHaveBeenCalledTimes(1);
  });

  it('shares the memoized span-metrics and IRM probes between repeated snapshot reads', async () => {
    const { result } = renderHook(() => useHomepageSolutions());

    await Promise.all([result.current.signals(), result.current.signals()]);

    expect(mockProbeSpanMetrics).toHaveBeenCalledTimes(1);
    expect(mockDetectIrmSignal).toHaveBeenCalledTimes(1);
  });

  it('maps a rejecting solution getter to unknown without rejecting the snapshot', async () => {
    fixtures.logs.signal = jest.fn(async () => {
      throw new Error('Loki unavailable');
    });
    const { result } = renderHook(() => useHomepageSolutions());

    await expect(result.current.signals()).resolves.toEqual(expect.objectContaining({ logs: 'unknown' }));
  });

  it('maps a rejecting IRM signal to unknown without rejecting the snapshot', async () => {
    mockDetectIrmSignal.mockRejectedValue(new Error('IRM unavailable'));
    const { result } = renderHook(() => useHomepageSolutions());

    await expect(result.current.signals()).resolves.toEqual(expect.objectContaining({ irm: 'unknown' }));
  });

  it('recreates only the Kubernetes solution when its filter changes', () => {
    mockFactories.kubernetes.mockImplementation(() => solution('kubernetes', 'active'));
    const { result } = renderHook(() => useHomepageSolutions());
    const first = result.current;

    act(() => {
      store.set(
        solutionFilterStorageKey('kubernetes'),
        JSON.stringify({
          datasourceUid: 'prometheus',
          datasourceName: 'Prometheus',
          cluster: 'prod',
          namespaces: [],
          nodes: [],
        })
      );
    });

    expect(mockFactories.kubernetes).toHaveBeenCalledTimes(2);
    expect(mockFactories.kubernetes).toHaveBeenLastCalledWith(
      expect.objectContaining({ cluster: 'prod' }),
      detectKubernetes
    );
    expect(result.current.solutions[0]).not.toBe(first.solutions[0]);
    result.current.solutions.slice(1).forEach((current, index) => {
      expect(current).toBe(first.solutions[index + 1]);
    });
    expect(result.current.signals).toBe(first.signals);
    for (const id of ['traces', 'metrics', 'logs', 'synthetics'] as const) {
      expect(mockFactories[id]).toHaveBeenCalledTimes(1);
    }
  });

  it('recreates only the metrics solution when its filter changes', () => {
    mockFactories.metrics.mockImplementation(() => solution('metrics', 'active'));
    const { result } = renderHook(() => useHomepageSolutions());
    const first = result.current;

    act(() => {
      store.set(
        solutionFilterStorageKey('metrics'),
        JSON.stringify({
          datasourceUid: 'prometheus',
          datasourceName: 'Prometheus',
          excludes: [{ label: 'instance', regex: 'cache-.*' }],
          ratioExpr: '',
        })
      );
    });

    expect(mockFactories.metrics).toHaveBeenCalledTimes(2);
    expect(mockFactories.metrics).toHaveBeenLastCalledWith(
      expect.objectContaining({ excludes: [{ label: 'instance', regex: 'cache-.*' }] }),
      detectMetrics
    );
    expect(result.current.solutions[1]).not.toBe(first.solutions[1]);
    result.current.solutions.forEach((current, index) => {
      if (index !== 1) {
        expect(current).toBe(first.solutions[index]);
      }
    });
    expect(result.current.signals).toBe(first.signals);
    for (const id of ['kubernetes', 'traces', 'logs', 'synthetics'] as const) {
      expect(mockFactories[id]).toHaveBeenCalledTimes(1);
    }
  });
});
