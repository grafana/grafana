import { Databases } from '../shared/core';

export interface CompatibleServicePayload {
  service_id: string;
  service_name: string;
}

export type CompatibleServiceListPayload = { [key in Databases]?: CompatibleServicePayload[] };

export interface Service {
  id: string;
  name: string;
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
  STARTING = 'STARTING',
  RUNNING = 'RUNNING',
  WAITING = 'WAITING',
  STOPPING = 'STOPPING',
  DONE = 'DONE',
  UNKNOWN = 'UNKNOWN',
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

export interface ServiceAgent {
  agentId: string;
  status?: ServiceAgentStatus;
  customLabels?: Record<string, string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface Agent {
  type: AgentType;
  params: ServiceAgent;
}
