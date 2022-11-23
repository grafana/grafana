import { onKubeConfigValueChange } from './EditK8sClusterPage.utils';
import kubeConfigFile from './KubeConfigTestMock';

describe('EditK8sClusterPage.utils::', () => {
  it('getClusterNameFromKubeConfig returns name of cluster', () => {
    const mutatorMock = jest.fn();
    onKubeConfigValueChange(kubeConfigFile, mutatorMock);
    expect(mutatorMock).toBeCalledWith(kubeConfigFile, 'minikube');
  });
});
