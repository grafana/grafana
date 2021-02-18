import { Kubernetes, DeleteKubernetesAction, AddKubernetesAction } from '../Kubernetes.types';
import { kubernetesStub, deleteActionStub, addActionStub } from './kubernetesStubs';

export const useKubernetes = (): [Kubernetes[], DeleteKubernetesAction, AddKubernetesAction, boolean] => [
  kubernetesStub,
  deleteActionStub,
  addActionStub,
  false,
];
