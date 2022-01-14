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
  [Databases.mysql]: 'PXC',
  [Databases.mongodb]: 'PSMDB',
  [Databases.postgresql]: '',
  [Databases.proxysql]: '',
  [Databases.mariadb]: '',
  [Databases.haproxy]: '',
};

export const OPERATOR_FULL_LABELS = {
  [Databases.mysql]: 'Percona XtraDB Cluster',
  [Databases.mongodb]: 'Percona Server for MongoDB',
  [Databases.postgresql]: '',
  [Databases.proxysql]: '',
  [Databases.mariadb]: '',
  [Databases.haproxy]: '',
};
