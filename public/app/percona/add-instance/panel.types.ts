// TODO: refactor this type to have separated interfaces for Azure and RDS types of instances
export interface RemoteInstanceCredentials {
  serviceName?: string;
  username?: string;
  port?: string;
  address?: string;
  isRDS?: boolean;
  isAzure?: boolean;
  region?: string;
  aws_access_key?: string;
  aws_secret_key?: string;
  azure_client_id?: string;
  azure_client_secret?: string;
  azure_tenant_id?: string;
  azure_subscription_id?: string;
  azure_resource_group?: string;
  azure_database_exporter?: boolean;
  instance_id?: string;
  az?: string;
}

export enum InstanceTypes {
  rds = 'rds',
  azure = 'azure',
  postgresql = 'postgresql',
  mysql = 'mysql',
  proxysql = 'proxysql',
  mongodb = 'mongodb',
  external = 'external',
  haproxy = 'haproxy',
  mariadb = 'mariadb',
}

export const INSTANCE_TYPES_LABELS = {
  [InstanceTypes.mysql]: 'MySQL',
  [InstanceTypes.mariadb]: 'MariaDB',
  [InstanceTypes.mongodb]: 'MongoDB',
  [InstanceTypes.postgresql]: 'PostgreSQL',
  [InstanceTypes.proxysql]: 'ProxySQL',
  [InstanceTypes.haproxy]: 'HAProxy',
};
