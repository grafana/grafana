import { ManageKubernetes } from '../Kubernetes.types';
import {
  kubernetesStub,
  deleteActionStub,
  addActionStub,
  getActionStub,
  setLoadingActionStub,
} from './kubernetesStubs';

export const useKubernetes = (): ManageKubernetes => [
  kubernetesStub,
  deleteActionStub,
  addActionStub,
  getActionStub,
  setLoadingActionStub,
  false,
];
