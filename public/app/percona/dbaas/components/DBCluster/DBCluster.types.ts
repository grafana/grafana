import { SelectableValue } from '@grafana/data';
import { Databases } from 'app/percona/shared/core';

import { DBClusterService } from './DBCluster.service';
import { Operators } from './EditDBClusterPage/DBClusterBasicOptions/DBClusterBasicOptions.types';

export type AddDBClusterAction = (dbCluster: DBCluster) => void;
export type GetDBClustersAction = () => void;
export type SetDBClustersLoadingAction = (loading: boolean) => void;
export type ManageDBClusters = [DBCluster[], GetDBClustersAction, SetDBClustersLoadingAction, boolean];

export enum DBClusterType {
  pxc = 'DB_CLUSTER_TYPE_PXC',
  psmdb = 'DB_CLUSTER_TYPE_PSMDB',
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
  databaseImage?: string;
  expose?: boolean;
  installedImage?: string;
  availableImage?: string;
}

export enum DBClusterStatus {
  invalid = 'DB_CLUSTER_STATE_INVALID',
  changing = 'DB_CLUSTER_STATE_CHANGING',
  ready = 'DB_CLUSTER_STATE_READY',
  failed = 'DB_CLUSTER_STATE_FAILED',
  deleting = 'DB_CLUSTER_STATE_DELETING',
  suspended = 'DB_CLUSTER_STATE_PAUSED',
  upgrading = 'DB_CLUSTER_STATE_UPGRADING',
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

export type DatabaseOperatorsMap = {
  [key in Operators]: Databases;
};

export type ActiveOperatorsMap = {
  [key in Operators]?: boolean;
};

export interface DBClusterConnection {
  host: string;
  password: string;
  port: number;
  username: string;
}

export interface DBClusterLogs {
  pods: DBClusterPodLogs[];
}

export interface DBClusterPodLogs {
  name: string;
  isOpen: boolean;
  events: string;
  containers: DBClusterContainerLogs[];
}

export interface DBClusterContainerLogs {
  name: string;
  isOpen: boolean;
  logs: string;
}

export interface DBClusterAllocatedResources {
  total: DBClusterResources;
  allocated: DBClusterResources;
}

export interface DBClusterExpectedResources {
  expected: DBClusterResources;
}

interface DBClusterResources {
  cpu: ResourcesWithUnits;
  disk: ResourcesWithUnits;
  memory: ResourcesWithUnits;
}

export interface ResourcesWithUnits {
  value: number;
  units: ResourcesUnits | CpuUnits;
  original: number;
}

export enum ResourcesUnits {
  BYTES = 'Bytes',
  KB = 'KB',
  MB = 'MB',
  GB = 'GB',
  TB = 'TB',
  PB = 'PB',
  EB = 'EB',
}

export enum CpuUnits {
  MILLI = 'CPU',
}

export interface DatabaseVersion extends SelectableValue {
  default: boolean;
  disabled: boolean;
}

export interface DBClusterPayload {
  kubernetes_cluster_name: string;
  name: string;
  state?: DBClusterStatus;
  operation?: DBClusterOperationAPI;
  params: DBClusterParamsAPI;
  suspend?: boolean;
  resume?: boolean;
  expose?: boolean;
  exposed?: boolean;
  installed_image?: string;
  available_image?: string;
  image?: string;
}

export interface DBClusterActionAPI {
  kubernetes_cluster_name: string;
  name: string;
  cluster_type: DBClusterType;
}

interface DBClusterParamsAPI {
  cluster_size: number;
  pxc?: DBClusterContainerAPI;
  haproxy?: Omit<DBClusterContainerAPI, 'disk_size'>;
  replicaset?: DBClusterContainerAPI;
  image?: string;
}

interface DBClusterContainerAPI {
  compute_resources: DBClusterComputeResourcesAPI;
  disk_size: number;
  image?: string;
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

export interface DBClusterLogsAPI {
  logs: DBClusterLogAPI[];
}

export interface DBClusterLogAPI {
  pod: string;
  container?: string;
  logs: string[];
}

export interface DBClusterAllocatedResourcesAPI {
  all: ResourcesAPI;
  available: ResourcesAPI;
}

export interface DBClusterExpectedResourcesAPI {
  expected: ResourcesAPI;
}

interface ResourcesAPI {
  cpu_m: number;
  disk_size: number;
  memory_bytes: number;
}

export interface DBClusterComponents {
  versions: DBClusterVersion[];
}

export interface DBClusterVersion {
  product: string;
  operator: string;
  matrix: DBClusterMatrix;
}

export interface DBClusterMatrix {
  mongod?: DBClusterComponent;
  pxc?: DBClusterComponent;
  pmm?: DBClusterComponent;
  proxysql?: DBClusterComponent;
  haproxy?: DBClusterComponent;
  backup?: DBClusterComponent;
  operator?: DBClusterComponent;
  log_collector?: DBClusterComponent;
}

export interface DBClusterComponent {
  [key: string]: {
    image_path: string;
    image_hash: string;
    status: string;
    critical: boolean;
    default?: boolean;
    disabled?: boolean;
  };
}

export enum DBClusterComponentVersionStatus {
  available = 'available',
  recommended = 'recommended',
}

export interface DBClusterChangeComponentsAPI {
  kubernetes_cluster_name: string;
  pxc?: DBClusterChangeComponentAPI;
  haproxy?: DBClusterChangeComponentAPI;
  mongod?: DBClusterChangeComponentAPI;
}

export interface DBClusterChangeComponentAPI {
  default_version?: string;
  versions: DBClusterChangeComponentVersionAPI[];
}

export interface DBClusterChangeComponentVersionAPI {
  version: string;
  disable?: boolean;
  enable?: boolean;
}

export interface DBClusterListResponse {
  pxc_clusters: DBClusterPayload[];
  psmdb_clusters: DBClusterPayload[];
}

export interface DBClusterSuspendResumeRequest {
  kubernetes_cluster_name: string;
  name: string;
  params: DBClusterSuspendParamsRequest | DBClusterResumeParamsRequest;
}

export interface DBClusterSuspendParamsRequest {
  suspend: boolean;
}

export interface DBClusterResumeParamsRequest {
  resume: boolean;
}
