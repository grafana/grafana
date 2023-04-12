import { Databases } from './types';

export const API = {
  ALERTMANAGER: '/alertmanager/api/v2',
  SETTINGS: '/v1/Settings/Get',
};

export const DATABASE_LABELS = {
  [Databases.mysql]: 'MySQL',
  [Databases.mongodb]: 'MongoDB',
  [Databases.postgresql]: 'PostgreSQL',
  [Databases.proxysql]: 'ProxySQL',
  [Databases.mariadb]: 'MariaDB',
  [Databases.haproxy]: 'HAProxy',
};

export const OPERATOR_LABELS = {
  [Databases.mysql]: 'Percona Operator for MySQL',
  [Databases.mongodb]: 'Percona Operator for MongoDB',
  [Databases.postgresql]: 'Percona Operator for PostgreSQL',
  [Databases.proxysql]: '',
  [Databases.mariadb]: '',
  [Databases.haproxy]: '',
};

export const OPERATOR_FULL_LABELS = {
  [Databases.mysql]: 'Percona Operator for MySQL',
  [Databases.mongodb]: 'Percona Operator for MongoDB',
  [Databases.postgresql]: 'Percona Operator for PostgreSQL',
  [Databases.proxysql]: '',
  [Databases.mariadb]: '',
  [Databases.haproxy]: '',
};

export const PERCONA_CANCELLED_ERROR_NAME = 'percona-cancelled-request';
export const PRIMARY_LABELS = [
  'node_name',
  'type',
  'container_name',
  'region',
  'az',
  'service_name',
  'environment',
  'cluster',
  'replication_set',
];
export const HIDDEN_LABELS = ['alertname', 'job', 'rule_id', 'template_name', 'severity', 'ia'];
export const SETTINGS_TIMEOUT = 1500;

export const DATABASE_ICONS: Record<Databases, string> = {
  [Databases.mysql]: 'percona-database-mysql',
  [Databases.mongodb]: 'percona-database-mongodb',
  [Databases.postgresql]: 'percona-database-postgresql',
  [Databases.proxysql]: 'percona-database-proxysql',
  [Databases.mariadb]: 'percona-database-mysql',
  [Databases.haproxy]: 'percona-database-haproxy',
};
