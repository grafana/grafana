import { ServiceAgentStatus } from 'app/percona/inventory/Inventory.types';

import { Databases } from '../../core';

export enum ServiceType {
  unspecified = 'SERVICE_TYPE_UNSPECIFIED',
  mysql = 'SERVICE_TYPE_MYSQL_SERVICE',
  mongodb = 'SERVICE_TYPE_MONGODB_SERVICE',
  posgresql = 'SERVICE_TYPE_POSTGRESQL_SERVICE',
  proxysql = 'SERVICE_TYPE_PROXYSQL_SERVICE',
  haproxy = 'SERVICE_TYPE_HAPROXY_SERVICE',
  external = 'SERVICE_TYPE_EXTERNAL_SERVICE',
}

export enum ServiceStatus {
  UP = 'STATUS_UP',
  DOWN = 'STATUS_DOWN',
  UNKNOWN = 'STATUS_UNKNOWN',
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

export interface DbAgent {
  agentId: string;
  status?: ServiceAgentStatus;
  agentType?: string;
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
  agents?: DbAgent[];
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

export interface UpdateServiceBody {
  service_id: string;
  environment?: string;
  cluster?: string;
  replication_set?: string;
  external_group?: string;
}
