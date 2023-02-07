import { api } from 'app/percona/shared/helpers/api';

import { DBaaSBackup, DBaaSBackupListResponse } from './DBaaSBackups.types';

const BASE_URL = '/v1/management/DBaaS/Backups';

export const DBaaSBackupService = {
  async list(locationId: string): Promise<DBaaSBackup[]> {
    const { backups = [] } = await api.post<DBaaSBackupListResponse, Object>(
      `${BASE_URL}/List`,
      {
        location_id: locationId,
      },
      false
    );
    return backups;
  },
};
