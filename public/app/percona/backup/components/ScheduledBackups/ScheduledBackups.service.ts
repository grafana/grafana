import { CancelToken } from 'axios';

import { api } from 'app/percona/shared/helpers/api';

import { BackupMode, DataModel } from '../../Backup.types';

import { ScheduledBackup, ScheduledBackupResponse } from './ScheduledBackups.types';

const BASE_URL = '/v1/management/backup/Backups';

export const ScheduledBackupsService = {
  async list(token?: CancelToken): Promise<ScheduledBackup[]> {
    const { scheduled_backups = [] } = await api.post<ScheduledBackupResponse, Object>(
      `${BASE_URL}/ListScheduled`,
      {},
      false,
      token
    );

    return scheduled_backups.map(
      ({
        scheduled_backup_id,
        name,
        vendor,
        start_time,
        cron_expression,
        location_id,
        location_name,
        service_id,
        service_name,
        last_run,
        data_model,
        description,
        retries,
        retry_interval,
        enabled,
        retention = 0,
        mode,
      }) => ({
        id: scheduled_backup_id,
        name,
        vendor,
        start: new Date(start_time).getTime(),
        retention,
        cronExpression: cron_expression,
        locationId: location_id,
        locationName: location_name,
        serviceId: service_id,
        serviceName: service_name,
        lastBackup: last_run ? new Date(last_run).getTime() : undefined,
        dataModel: data_model,
        description,
        mode,
        retryTimes: retries,
        retryInterval: retry_interval,
        enabled: !!enabled,
      })
    );
  },
  async schedule(
    serviceId: string,
    locationId: string,
    cronExpression: string,
    name: string,
    description: string,
    retryInterval: string,
    retryTimes: number,
    retention: number,
    enabled: boolean,
    mode: BackupMode,
    dataModel: DataModel
  ) {
    return api.post(`${BASE_URL}/Schedule`, {
      service_id: serviceId,
      location_id: locationId,
      cron_expression: cronExpression,
      name,
      description,
      retry_interval: retryInterval,
      retries: retryTimes,
      enabled: !!enabled,
      retention,
      mode,
      data_model: dataModel,
    });
  },
  async toggle(id: string, enabled: boolean) {
    return api.post(`${BASE_URL}/ChangeScheduled`, { scheduled_backup_id: id, enabled });
  },
  async delete(id: string) {
    return api.post(`${BASE_URL}/RemoveScheduled`, { scheduled_backup_id: id });
  },
};
