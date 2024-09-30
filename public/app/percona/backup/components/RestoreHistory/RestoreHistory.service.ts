import { CancelToken } from 'axios';

import { api } from 'app/percona/shared/helpers/api';

import { BackupLogResponse, BackupLogs } from '../../Backup.types';

import { Restore, RestoreResponse } from './RestoreHistory.types';

const BASE_URL = '/v1/backups';

export const RestoreHistoryService = {
  async list(cancelToken?: CancelToken): Promise<Restore[]> {
    const { items = [] } = await api.get<RestoreResponse, object>(`${BASE_URL}/restores`, false, { cancelToken });
    return items.map(
      ({
        restore_id,
        artifact_id,
        name,
        vendor,
        location_id,
        location_name,
        service_id,
        service_name,
        data_model,
        status,
        started_at,
        finished_at,
        pitr_timestamp,
      }) => ({
        id: restore_id,
        artifactId: artifact_id,
        name,
        vendor,
        locationId: location_id,
        locationName: location_name,
        serviceId: service_id,
        serviceName: service_name,
        dataModel: data_model,
        status,
        started: new Date(started_at).getTime(),
        finished: finished_at ? new Date(finished_at).getTime() : null,
        pitrTimestamp: pitr_timestamp ? new Date(pitr_timestamp).getTime() : undefined,
      })
    );
  },
  async getLogs(artefactId: string, offset: number, limit: number, cancelToken?: CancelToken): Promise<BackupLogs> {
    const { logs = [], end } = await api.get<BackupLogResponse, { offset: number; limit: number }>(
      `${BASE_URL}/${artefactId}/logs`,
      false,
      { cancelToken, params: { offset, limit } }
    );

    return {
      logs: logs.map(({ chunk_id = 0, data, time }) => ({ id: chunk_id, data, time })),
      end,
    };
  },
};
