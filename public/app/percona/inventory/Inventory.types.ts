import { Databases } from '../shared/core';
import { DbNode, NodeType } from '../shared/services/nodes/Nodes.types';
import {
  DbAgent,
  DbService,
  DbServiceWithAddress,
  ServiceStatus,
  ServiceType,
} from '../shared/services/services/Services.types';

export interface CompatibleServicePayload {
  service_id: string;
  service_name: string;
  cluster?: string;
}

export type CompatibleServiceListPayload = { [key in Databases]?: CompatibleServicePayload[] };

export interface Service {
  id: string;
  name: string;
  cluster?: string;
}

export type DBServiceList = { [key in Databases]?: Service[] };

export enum AgentType {
  amazonRdsMysql = 'amazon_rds_mysql',
  container = 'container',
  externalExporter = 'externalExporter',
  generic = 'generic',
  mongodb = 'mongodb',
  mongodbExporter = 'mongodbExporter',
  mysql = 'mysql',
  mysqldExporter = 'mysqldExporter',
  nodeExporter = 'nodeExporter',
  pmmAgent = 'pmm_agent',
  postgresExporter = 'postgresExporter',
  postgresql = 'postgresql',
  proxysql = 'proxysql',
  proxysqlExporter = 'proxysqlExporter',
  qanMongodb_profiler_agent = 'qan_mongodb_profiler_agent',
  qanMysql_perfschema_agent = 'qan_mysql_perfschema_agent',
  qanMysql_slowlog_agent = 'qan_mysql_slowlog_agent',
  qanPostgresql_pgstatements_agent = 'qan_postgresql_pgstatements_agent',
  qanPostgresql_pgstatmonitor_agent = 'qan_postgresql_pgstatmonitor_agent',
  rdsExporter = 'rdsExporter',
  remote = 'remote',
  remote_rds = 'remote_rds',
  vmAgent = 'vm_agent',
}

export enum ServiceAgentStatus {
  STARTING = 'AGENT_STATUS_STARTING',
  RUNNING = 'AGENT_STATUS_RUNNING',
  WAITING = 'AGENT_STATUS_WAITING',
  STOPPING = 'AGENT_STATUS_STOPPING',
  DONE = 'AGENT_STATUS_DONE',
  UNKNOWN = 'AGENT_STATUS_UNKNOWN',
}

export enum MonitoringStatus {
  OK = 'OK',
  FAILED = 'Failed',
}

export interface ServiceAgentPayload {
  agent_id: string;
  agent_type: AgentType;
  status?: ServiceAgentStatus;
  is_connected?: boolean;
  custom_labels?: Record<string, string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export type ServiceAgentListPayload = {
  agents: ServiceAgentPayload[];
};

export type ServiceAgent = {
  agentId: string;
  status?: ServiceAgentStatus;
  customLabels?: Record<string, string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

export interface Agent {
  type: AgentType;
  params: ServiceAgent;
}

export interface RemoveAgentBody {
  id: string;
}
export interface RemoveNodeBody {
  node_id: string;
  force: boolean;
}

interface DbAgentNode {
  agent_id: string;
  agent_type: AgentType;
  status: ServiceAgentStatus;
  is_connected?: boolean;
}

interface ServiceNodeListDB {
  service_id: string;
  service_type: ServiceType;
  service_name: string;
}

interface ServiceNodeList {
  serviceId: string;
  serviceType: ServiceType;
  serviceName: string;
}

export interface Node {
  nodeId: string;
  nodeType: string;
  nodeName: string;
  machineId?: string;
  distro?: string;
  address: string;
  nodeModel?: string;
  region?: string;
  az?: string;
  containerId?: string;
  containerName?: string;
  customLabels?: Record<string, string>;
  agents?: DbAgent[];
  createdAt: string;
  updatedAt: string;
  status: ServiceStatus;
  services?: ServiceNodeList[];
  properties?: Record<string, string>;
  agentsStatus?: string;
}

export interface NodeDB {
  node_id: string;
  node_type: string;
  node_name: string;
  machine_id?: string;
  distro?: string;
  address: string;
  node_model?: string;
  region?: string;
  az?: string;
  container_id?: string;
  container_name?: string;
  custom_labels?: Record<string, string>;
  agents?: DbAgentNode[];
  created_at: string;
  updated_at: string;
  status: ServiceStatus;
  services?: ServiceNodeListDB[];
}

export interface NodeListDBPayload {
  nodes: NodeDB[];
}
export type FlattenAgent = ServiceAgent & {
  type: AgentType;
};

export type FlattenService = DbService &
  Partial<DbServiceWithAddress> & {
    type: Databases | 'external';
    agentsStatus: string;
  };

export type FlattenNode = DbNode & {
  type: NodeType;
};
