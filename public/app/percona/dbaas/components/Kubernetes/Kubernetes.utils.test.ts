import { isKubernetesListUnavailable } from './Kubernetes.utils';
import { KubernetesClusterStatus } from './KubernetesClusterStatus/KubernetesClusterStatus.types';
import { kubernetesStub } from './__mocks__/kubernetesStubs';

describe('Kubernetes.utils:: ', () => {
  it('should return false when there are clusters available', () => {
    expect(isKubernetesListUnavailable(kubernetesStub)).toBeFalsy();
  });
  it('should return true when there are no clusters available', () => {
    const kubernetes = [
      { ...kubernetesStub[0], status: KubernetesClusterStatus.invalid },
      { ...kubernetesStub[1], status: KubernetesClusterStatus.unavailable },
    ];
    expect(isKubernetesListUnavailable(kubernetes)).toBeTruthy();
  });
});
