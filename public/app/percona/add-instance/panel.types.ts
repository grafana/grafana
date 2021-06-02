export interface RemoteInstanceCredentials {
  serviceName?: string;
  port?: number;
  address?: string;
  isRDS?: boolean;
  region?: string;
  aws_access_key?: string;
  aws_secret_key?: string;
  instance_id?: string;
  az?: string;
}

export enum InstanceTypes {
  rds = 'rds',
  postgresql = 'postgresql',
  mysql = 'mysql',
  proxysql = 'proxysql',
  mongodb = 'mongodb',
  external = 'external',
  haproxy = 'haproxy',
}

export const INSTANCE_TYPES_LABELS = {
  [InstanceTypes.mysql]: 'MySQL',
  [InstanceTypes.mongodb]: 'MongoDB',
  [InstanceTypes.postgresql]: 'PostgreSQL',
  [InstanceTypes.proxysql]: 'ProxySQL',
  [InstanceTypes.haproxy]: 'HAProxy',
};
