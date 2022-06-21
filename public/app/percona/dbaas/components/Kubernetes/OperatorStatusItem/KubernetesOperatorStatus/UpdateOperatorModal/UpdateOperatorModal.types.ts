import { Kubernetes, OperatorToUpdate } from '../../../Kubernetes.types';

export interface UpdateOperatorModalProps {
  kubernetesClusterName: string;
  selectedOperator: OperatorToUpdate;
  isVisible: boolean;
  setVisible: (value: boolean) => void;
  setLoading: (loading: boolean) => void;
  setSelectedCluster: (kubernetes: Kubernetes | null) => void;
  setOperatorToUpdate: (operator: OperatorToUpdate | null) => void;
  onOperatorUpdated: () => void;
}
