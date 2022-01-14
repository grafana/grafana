import { Kubernetes } from '../Kubernetes.types';

export interface ViewKubernetesClusterModalProps {
  selectedCluster?: Kubernetes;
  isVisible: boolean;
  setVisible: (value: boolean) => void;
}
