import { CancelToken } from 'axios';

import { SelectableValue } from '@grafana/data';
import { DBServiceList, CompatibleServiceListPayload } from 'app/percona/inventory/Inventory.types';
import { api } from 'app/percona/shared/helpers/api';

import { BackupLogResponse, BackupLogs, DataModel } from '../../Backup.types';

import { Backup, BackupResponse, Timeranges, TimerangesResponse } from './BackupInventory.types';
import { formatDate } from './BackupInventory.utils';

const BASE_URL = '/v1/management/backup';

export const BackupInventoryService = {
  async list(token?: CancelToken): Promise<Backup[]> {
    const { artifacts = [] } = await api.post<BackupResponse, Object>(`${BASE_URL}/Artifacts/List`, {}, false, token);
    return artifacts.map(
      ({
        artifact_id,
        name,
        location_id,
        location_name,
        created_at,
        service_id,
        service_name,
        data_model,
        status,
        vendor,
        mode,
      }): Backup => ({
        id: artifact_id,
        name,
        created: new Date(created_at).getTime(),
        locationId: location_id,
        locationName: location_name,
        serviceId: service_id,
        serviceName: service_name,
        dataModel: data_model,
        status,
        vendor,
        mode,
      })
    );
  },
  async listPitrTimeranges(artifactId: string): Promise<Array<SelectableValue<Timeranges>>> {
    const { timeranges = [] } = await api.post<TimerangesResponse, Object>(`${BASE_URL}/Artifacts/ListPITRTimeranges`, {
      artifact_id: artifactId,
    });
    return timeranges.map((value) => ({
      label: `${formatDate(value.start_timestamp)} / ${formatDate(value.end_timestamp)}`,
      value: { startTimestamp: value.start_timestamp, endTimestamp: value.end_timestamp },
    }));
  },
  async restore(serviceId: string, artifactId: string, pitrTimestamp?: string, token?: CancelToken) {
    return api.post(
      `${BASE_URL}/Backups/Restore`,
      {
        service_id: serviceId,
        artifact_id: artifactId,
        pitr_timestamp: pitrTimestamp,
      },
      false,
      token
    );
  },
  async backup(
    serviceId: string,
    locationId: string,
    name: string,
    description: string,
    retryInterval: string,
    retryTimes: number,
    dataModel: DataModel,
    token?: CancelToken
  ) {
    return api.post(
      `${BASE_URL}/Backups/Start`,
      {
        service_id: serviceId,
        location_id: locationId,
        name,
        description,
        retry_interval: retryInterval,
        retries: retryTimes,
        data_model: dataModel,
      },
      false,
      token
    );
  },
  async delete(artifactId: string, removeFiles: boolean) {
    return api.post(`${BASE_URL}/Artifacts/Delete`, { artifact_id: artifactId, remove_files: removeFiles });
  },
  async getLogs(artifactId: string, offset: number, limit: number, token?: CancelToken): Promise<BackupLogs> {
    const { logs = [], end } = await api.post<BackupLogResponse, Object>(
      `${BASE_URL}/Backups/GetLogs`,
      {
        artifact_id: artifactId,
        offset,
        limit,
      },
      false,
      token
    );

    return {
      logs: logs.map(({ chunk_id = 0, data, time }) => ({ id: chunk_id, data, time })),
      end,
    };
  },
  async listCompatibleServices(artifactId: string): Promise<DBServiceList> {
    const { mysql = [], mongodb = [] } = await api.post<CompatibleServiceListPayload, Object>(
      `${BASE_URL}/Backups/ListArtifactCompatibleServices`,
      {
        artifact_id: artifactId,
      }
    );

    const result: DBServiceList = {
      mysql: mysql.map(({ service_id, service_name }) => ({ id: service_id, name: service_name })),
      mongodb: mongodb.map(({ service_id, service_name }) => ({ id: service_id, name: service_name })),
    };

    return result;
  },
};
