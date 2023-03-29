import { Kubernetes } from '../../../../../dbaas/components/Kubernetes/Kubernetes.types';

export interface PerconaK8SClusterListState {
  result?: Kubernetes[];
  loading?: boolean;
}
