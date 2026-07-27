import { renderHook } from '@testing-library/react';

import { type ExistingItem } from './types';
import { useExistingSolutions } from './useExistingSolutions';
import { useKubernetesSolution } from './useKubernetesSolution';
import { useMetricsSolution } from './useMetricsSolution';

jest.mock('./useKubernetesSolution', () => ({
  useKubernetesSolution: jest.fn(),
}));

jest.mock('./useMetricsSolution', () => ({
  useMetricsSolution: jest.fn(),
}));

const mockUseKubernetesSolution = jest.mocked(useKubernetesSolution);
const mockUseMetricsSolution = jest.mocked(useMetricsSolution);

const kubernetesItem: ExistingItem = {
  id: 'kubernetes-monitoring',
  title: 'Kubernetes Monitoring',
  icon: 'kubernetes',
  action: 'Open K8s app',
  href: '#',
};

const metricsItem: ExistingItem = {
  id: 'metrics',
  title: 'Metrics & infrastructure',
  icon: 'chart-line',
  action: 'Open metrics',
  href: '#',
};

beforeEach(() => {
  mockUseMetricsSolution.mockReturnValue({ loading: false, item: null });
});

describe('useExistingSolutions', () => {
  it('reports loading while a provider is still probing and nothing was found', () => {
    mockUseKubernetesSolution.mockReturnValue({ loading: true, item: null });

    const { result } = renderHook(() => useExistingSolutions());

    expect(result.current).toEqual({ loading: true, solutions: [] });
  });

  it('settles empty when every provider settles without an item', () => {
    mockUseKubernetesSolution.mockReturnValue({ loading: false, item: null });

    const { result } = renderHook(() => useExistingSolutions());

    expect(result.current).toEqual({ loading: false, solutions: [] });
  });

  it('returns the provider item once found', () => {
    mockUseKubernetesSolution.mockReturnValue({ loading: false, item: kubernetesItem });

    const { result } = renderHook(() => useExistingSolutions());

    expect(result.current).toEqual({ loading: false, solutions: [kubernetesItem] });
  });

  it('includes a discovered Metrics provider in registry order', () => {
    mockUseKubernetesSolution.mockReturnValue({ loading: false, item: kubernetesItem });
    mockUseMetricsSolution.mockReturnValue({ loading: false, item: metricsItem });

    const { result } = renderHook(() => useExistingSolutions());

    expect(result.current).toEqual({ loading: false, solutions: [kubernetesItem, metricsItem] });
  });

  it('renders a discovered solution immediately even if a provider still reports loading', () => {
    mockUseKubernetesSolution.mockReturnValue({ loading: true, item: kubernetesItem });

    const { result } = renderHook(() => useExistingSolutions());

    expect(result.current).toEqual({ loading: false, solutions: [kubernetesItem] });
  });
});
