import { AddKubernetesAction } from '../Kubernetes.types';

export interface AddKubernetesModalProps {
  isVisible: boolean;
  addKubernetes: AddKubernetesAction;
  setAddModalVisible: (isVisible: boolean) => void;
  showMonitoringWarning?: boolean;
}
