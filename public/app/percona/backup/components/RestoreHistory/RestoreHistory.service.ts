import { CancelToken } from 'axios';

import { api } from 'app/percona/shared/helpers/api';

import { Restore, RestoreResponse } from './RestoreHistory.types';

const BASE_URL = '/v1/management/backup';

export const RestoreHistoryService = {
  async list(token?: CancelToken): Promise<Restore[]> {
    const { items = [] } = await api.post<RestoreResponse, object>(`${BASE_URL}/RestoreHistory/List`, {}, false, token);
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
};
