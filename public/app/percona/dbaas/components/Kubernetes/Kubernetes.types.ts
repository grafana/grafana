import { KubernetesClusterStatus } from './KubernetesClusterStatus/KubernetesClusterStatus.types';
import { KubernetesOperatorStatus } from './OperatorStatusItem/KubernetesOperatorStatus/KubernetesOperatorStatus.types';

export interface KubernetesListAPI {
  kubernetes_clusters: KubernetesAPI[];
}

export interface Operator {
  status: KubernetesOperatorStatus;
  availableVersion?: string;
}

export interface OperatorsList {
  psmdb: Operator;
  xtradb: Operator;
}

export interface KubernetesAPI {
  kubernetes_cluster_name: string;
  operators: OperatorsList;
  status: string;
}

export interface Kubernetes {
  kubernetesClusterName: string;
  operators: OperatorsList;
  status: KubernetesClusterStatus;
}

export type DeleteKubernetesAction = (kubernetesToDelete: Kubernetes, force?: boolean) => void;
export type AddKubernetesAction = (kubernetesToAdd: NewKubernetesCluster) => void;

interface KubeAuth {
  kubeconfig: string;
}

export interface NewKubernetesClusterAPI {
  kubernetes_cluster_name: string;
  kube_auth: KubeAuth;
}

export interface CheckOperatorUpdateAPI {
  cluster_to_components: {
    [cluster: string]: ComponentToUpdateAPI;
  };
}

export interface ComponentToUpdateAPI {
  component_to_update_information: OperatorToUpdateAPI;
}

export interface OperatorToUpdateAPI {
  [ComponentToUpdate.psmdb]: ComponentVersionAPI;
  [ComponentToUpdate.pxc]: ComponentVersionAPI;
}

export interface ComponentVersionAPI {
  available_version?: string;
}

export enum ComponentToUpdate {
  psmdb = 'psmdb-operator',
  pxc = 'pxc-operator',
}

export interface NewKubernetesCluster {
  name: string;
  kubeConfig: string;
}

export interface KubernetesProps {
  kubernetes: Kubernetes[];
  deleteKubernetes: DeleteKubernetesAction;
  addKubernetes: AddKubernetesAction;
  loading: boolean;
}
