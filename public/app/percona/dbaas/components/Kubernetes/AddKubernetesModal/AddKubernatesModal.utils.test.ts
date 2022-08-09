import { onKubeConfigValueChange } from './AddKubernatesModal.utils';
import kubeConfigFile from './KubeConfigTestMock';

describe('AddKubernetesModal.utils::', () => {
  it('getClusterNameFromKubeConfig returns name of cluster', () => {
    const mutatorMock = jest.fn();
    onKubeConfigValueChange(kubeConfigFile, mutatorMock);
    expect(mutatorMock).toBeCalledWith(kubeConfigFile, 'minikube');
  });
});
