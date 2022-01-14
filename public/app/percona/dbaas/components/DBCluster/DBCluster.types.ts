import { Databases } from 'app/percona/shared/core';
import { Kubernetes } from '../Kubernetes/Kubernetes.types';
import { Operators } from './AddDBClusterModal/DBClusterBasicOptions/DBClusterBasicOptions.types';
import { DBClusterService } from './DBCluster.service';

export type AddDBClusterAction = (dbCluster: DBCluster) => void;
export type GetDBClustersAction = () => void;

export interface DBClusterProps {
  kubernetes: Kubernetes[];
}

export interface DBCluster {
  clusterName: string;
  kubernetesClusterName: string;
  databaseType: Databases;
  clusterSize: number;
  memory: number;
  cpu: number;
  disk: number;
  status?: DBClusterStatus;
  message?: string;
  suspend?: boolean;
  resume?: boolean;
  finishedSteps?: number;
  totalSteps?: number;
}

export enum DBClusterStatus {
  invalid = 'DB_CLUSTER_STATE_INVALID',
  changing = 'DB_CLUSTER_STATE_CHANGING',
  ready = 'DB_CLUSTER_STATE_READY',
  failed = 'DB_CLUSTER_STATE_FAILED',
  deleting = 'DB_CLUSTER_STATE_DELETING',
  suspended = 'DB_CLUSTER_STATE_PAUSED',
  unknown = 'DB_CLUSTER_STATE_UNKNOWN',
}

export type DBClusterStatusMap = {
  [key in DBClusterStatus]: string;
};

export type DBClusterServiceDatabasesMap = {
  [key in Databases]: DBClusterService;
};

export type OperatorDatabasesMap = {
  [key in Databases]: Operators;
};

export interface DBClusterConnection {
  host: string;
  password: string;
  port: number;
  username: string;
}

export interface DBClusterPayload {
  kubernetes_cluster_name: string;
  name: string;
  state?: DBClusterStatus;
  operation?: DBClusterOperationAPI;
  params: DBClusterParamsAPI;
  suspend?: boolean;
  resume?: boolean;
}

export interface DBClusterActionAPI {
  kubernetes_cluster_name: string;
  name: string;
}

interface DBClusterParamsAPI {
  cluster_size: number;
  pxc?: DBClusterContainerAPI;
  proxysql?: DBClusterContainerAPI;
  replicaset?: DBClusterContainerAPI;
}

interface DBClusterContainerAPI {
  compute_resources: DBClusterComputeResourcesAPI;
  disk_size: number;
}

interface DBClusterComputeResourcesAPI {
  cpu_m: number;
  memory_bytes: number;
}

interface DBClusterOperationAPI {
  message: string;
  finished_steps: number;
  total_steps: number;
}

export interface DBClusterConnectionAPI {
  connection_credentials: DBClusterConnection;
}
