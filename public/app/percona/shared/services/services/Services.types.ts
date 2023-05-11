import { ServiceAgentStatus } from 'app/percona/inventory/Inventory.types';

import { Databases } from '../../core';

export enum ServiceType {
  invalid = 'SERVICE_TYPE_INVALID',
  mysql = 'MYSQL_SERVICE',
  mongodb = 'MONGODB_SERVICE',
  posgresql = 'POSTGRESQL_SERVICE',
  proxysql = 'PROXYSQL_SERVICE',
  haproxy = 'HAPROXY_SERVICE',
  external = 'EXTERNAL_SERVICE',
}

export enum ServiceStatus {
  UP = 'UP',
  DOWN = 'DOWN',
  UNKNOWN = 'UNKNOWN',
  NA = 'N/A',
}

export interface ListServicesBody {
  node_id: string;
  service_type: ServiceType;
  external_group: string;
}

export interface DbServiceAgentPayload {
  agent_id: string;
  status?: ServiceAgentStatus;
  is_connected?: boolean;
}

export interface DbServicePayload {
  service_type: Databases | 'external';
  service_id: string;
  service_name: string;
  node_id: string;
  node_name: string;
  status?: ServiceStatus | 'STATUS_INVALID';
  enviroment?: string;
  cluster?: string;
  replication_set?: string;
  custom_labels?: Record<string, string>;
  agents?: DbServiceAgentPayload[];
}

export interface DbServiceWithAddressPayload extends DbServicePayload {
  address: string;
  port: number;
  socket: string;
}

export interface PostgreSQLServicePayload extends DbServiceWithAddressPayload {
  database_name: string;
}

export interface ExternalServicePayload extends DbServicePayload {
  group: string;
}

export interface ServiceListPayload {
  services?: Array<DbServicePayload | DbServiceWithAddressPayload | PostgreSQLServicePayload | ExternalServicePayload>;
}

export type Service = {
  type: Databases | 'external';
  params: DbService & Partial<DbServiceWithAddress>;
};

export interface DbServiceAgent {
  agentId: string;
  status?: ServiceAgentStatus;
  isConnected?: boolean;
}

export interface DbService {
  serviceId: string;
  serviceName: string;
  nodeId: string;
  nodeName: string;
  environment?: string;
  status: ServiceStatus;
  cluster?: string;
  replicationSet?: string;
  customLabels?: Record<string, string>;
  agents?: DbServiceAgent[];
}

export interface DbServiceWithAddress extends DbService {
  address: string;
  port: number;
}

export interface RemoveServiceBody {
  service_id: string;
  force: boolean;
}

export interface ListTypesPayload {
  service_types?: ServiceType[];
}
