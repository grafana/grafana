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
};
