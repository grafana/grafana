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

export interface ListServicesBody {
  node_id: string;
  service_type: ServiceType;
  external_group: string;
}

export interface DbServicePayload {
  service_id: string;
  service_name: string;
  node_id: string;
  enviroment?: string;
  cluster?: string;
  replication_set?: string;
  custom_labels?: Record<string, string>;
}

export interface DbServiceWithAddressPayload extends DbServicePayload {
  address: string;
  port: string;
  socket: string;
}

export interface PostgreSQLServicePayload extends DbServiceWithAddressPayload {
  database_name: string;
}

export interface ExternalServicePayload extends DbServicePayload {
  group: string;
}

export type ServiceListPayload = {
  [Databases.haproxy]?: DbServicePayload[];
  [Databases.mariadb]?: DbServiceWithAddressPayload[];
  [Databases.mongodb]?: DbServiceWithAddressPayload[];
  [Databases.mysql]?: DbServiceWithAddressPayload[];
  [Databases.postgresql]?: PostgreSQLServicePayload[];
  [Databases.proxysql]?: DbServiceWithAddressPayload[];
};

export interface RemoveServiceBody {
  service_id: string;
  force: boolean;
}

export interface ListTypesPayload {
  service_types?: ServiceType[];
}
