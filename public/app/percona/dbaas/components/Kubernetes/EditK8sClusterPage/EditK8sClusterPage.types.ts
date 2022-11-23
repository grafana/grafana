import { AddKubernetesAction } from '../Kubernetes.types';

export interface EditK8sClusterFormProps {
  showPMMAddressWarning: boolean;
  addKubernetes: AddKubernetesAction;
}
