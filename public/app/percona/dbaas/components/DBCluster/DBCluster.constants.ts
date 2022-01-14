import { Databases, DATABASE_LABELS } from 'app/percona/shared/core';
import { DBClusterServiceDatabasesMap } from './DBCluster.types';
import { PSMDBService } from './PSMDB.service';
import { XtraDBService } from './XtraDB.service';

export const ADVANCED_SETTINGS_URL = '/graph/d/pmm-settings/pmm-settings?menu=advanced-settings';

export const DATABASE_OPTIONS = [
  {
    value: Databases.mysql,
    label: DATABASE_LABELS.mysql,
  },
  {
    value: Databases.mongodb,
    label: DATABASE_LABELS.mongodb,
  },
];

export const SERVICE_MAP: Partial<DBClusterServiceDatabasesMap> = {
  [Databases.mysql]: new XtraDBService(),
  [Databases.mongodb]: new PSMDBService(),
};
