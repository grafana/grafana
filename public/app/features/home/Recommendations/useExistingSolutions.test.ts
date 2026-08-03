import { renderHook } from '@testing-library/react';

import { type ExistingItem } from './types';
import { useExistingSolutions } from './useExistingSolutions';
import { useKubernetesSolution } from './useKubernetesSolution';
import { useTelemetrySolutions } from './useTelemetrySolutions';

jest.mock('./useKubernetesSolution', () => ({
  useKubernetesSolution: jest.fn(),
}));

jest.mock('./useTelemetrySolutions', () => ({
  useTelemetrySolutions: jest.fn(),
}));

const mockUseKubernetesSolution = jest.mocked(useKubernetesSolution);
const mockUseTelemetrySolutions = jest.mocked(useTelemetrySolutions);

const kubernetesItem: ExistingItem = {
  id: 'kubernetes',
  title: 'Kubernetes Monitoring',
  icon: 'kubernetes',
  action: 'Open K8s app',
  href: '#',
};

const metricsItem: ExistingItem = {
  id: 'metrics',
  title: 'Metrics & infrastructure',
  icon: 'chart-line',
  action: 'Open Metrics Drilldown',
  href: '#',
};

const logsItem: ExistingItem = {
  id: 'logs',
  title: 'Hosted Logs',
  icon: 'gf-logs',
  action: 'Open Explore (Logs)',
  href: '#',
};

const tracesItem: ExistingItem = {
  id: 'traces',
  title: 'Hosted Traces',
  icon: 'gf-traces',
  action: 'Open Traces Drilldown',
  href: '#',
};

const settled = (item: ExistingItem | null) => ({ loading: false, item });

beforeEach(() => {
  mockUseKubernetesSolution.mockReturnValue(settled(null));
  mockUseTelemetrySolutions.mockReturnValue({ metrics: settled(null), logs: settled(null), traces: settled(null) });
});

describe('useExistingSolutions', () => {
  it('reports loading while a provider is still probing and nothing was found', () => {
    mockUseKubernetesSolution.mockReturnValue({ loading: true, item: null });

    const { result } = renderHook(() => useExistingSolutions());

    expect(result.current).toEqual({ loading: true, solutions: [] });
  });

  it('reports loading while a telemetry provider is still resolving', () => {
    mockUseTelemetrySolutions.mockReturnValue({
      metrics: settled(null),
      logs: { loading: true, item: null },
      traces: settled(null),
    });

    const { result } = renderHook(() => useExistingSolutions());

    expect(result.current).toEqual({ loading: true, solutions: [] });
  });

  it('settles empty when every provider settles without an item', () => {
    const { result } = renderHook(() => useExistingSolutions());

    expect(result.current).toEqual({ loading: false, solutions: [] });
  });

  it('returns the provider item once found', () => {
    mockUseKubernetesSolution.mockReturnValue(settled(kubernetesItem));

    const { result } = renderHook(() => useExistingSolutions());

    expect(result.current).toEqual({ loading: false, solutions: [kubernetesItem] });
  });

  it('orders solutions kubernetes, metrics, logs, traces with no duplicates', () => {
    mockUseKubernetesSolution.mockReturnValue(settled(kubernetesItem));
    mockUseTelemetrySolutions.mockReturnValue({
      metrics: settled(metricsItem),
      logs: settled(logsItem),
      traces: settled(tracesItem),
    });

    const { result } = renderHook(() => useExistingSolutions());

    expect(result.current.solutions).toEqual([kubernetesItem, metricsItem, logsItem, tracesItem]);
  });

  it('keeps reporting loading until every provider settles so the default selection is final', () => {
    mockUseKubernetesSolution.mockReturnValue({ loading: true, item: null });
    mockUseTelemetrySolutions.mockReturnValue({
      metrics: settled(null),
      logs: settled(logsItem),
      traces: settled(null),
    });

    const { result } = renderHook(() => useExistingSolutions());

    expect(result.current).toEqual({ loading: true, solutions: [logsItem] });
  });
});
