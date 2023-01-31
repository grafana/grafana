import { Databases } from 'app/percona/shared/core';

import { KubernetesClusterStatus } from './KubernetesClusterStatus/KubernetesClusterStatus.types';
import { KubernetesOperatorStatus } from './OperatorStatusItem/KubernetesOperatorStatus/KubernetesOperatorStatus.types';

export interface KubernetesListAPI {
  kubernetes_clusters: KubernetesAPI[];
}

export interface Operator {
  status: KubernetesOperatorStatus;
  version?: string;
  availableVersion?: string;
}

export interface OperatorToUpdate extends Operator {
  operatorType: ComponentToUpdate;
  operatorTypeLabel: string;
}

export interface OperatorsList {
  psmdb: Operator;
  pxc: Operator;
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

export type AddKubernetesAction = (kubernetesToAdd: NewKubernetesCluster, setPMMAddress?: boolean) => void;
export type SetKubernetesLoadingAction = (loading: boolean) => void;
export type ManageKubernetes = [Kubernetes[], SetKubernetesLoadingAction, boolean];

interface KubeAuth {
  kubeconfig: string;
}

export interface NewKubernetesClusterAPI {
  kubernetes_cluster_name: string;
  kube_auth: KubeAuth;
  aws_access_key_id?: string;
  aws_secret_access_key?: string;
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

export type DatabaseComponentToUpdateMap = { [key in Databases]?: ComponentToUpdate };

export interface InstallOperatorRequest {
  kubernetes_cluster_name: string;
  operator_type: ComponentToUpdate;
  version: string;
}

export interface StorageClassesRequest {
  kubernetes_cluster_name: string;
}
export interface StorageClassesResponse {
  storage_classes?: string[];
}

export interface InstallOperatorResponse {
  status: KubernetesOperatorStatus;
}

export interface NewKubernetesCluster {
  name: string;
  kubeConfig: string;
  isEKS: boolean;
  awsAccessKeyID?: string;
  awsSecretAccessKey?: string;
}

export interface KubernetesProps {
  kubernetes: Kubernetes[];
  setLoading: SetKubernetesLoadingAction;
  loading: boolean;
}

export interface KubeConfig {
  name?: string;
  server?: string;
  apiVersion?: string;
  clusters: Cluster[];
}

export interface Cluster {
  name?: string;
  cluster?: ClusterInfo;
}

export interface ClusterInfo {
  'certificate-authority-data'?: string;
  extensions?: {
    extension?: Extension[];
    name?: string;
  };
  server?: string;
}

interface Extension {
  extension?: ExtensionInfo;
  name?: string;
}

interface ExtensionInfo {
  'last-update'?: string;
  provider?: string;
  version?: string;
}

export interface KubeConfigResponse {
  kube_auth: KubeAuth;
}
