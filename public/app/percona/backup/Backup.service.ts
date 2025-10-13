import { CancelToken } from 'axios';

import { api } from 'app/percona/shared/helpers/api';

import { getCronStringFromValues } from '../shared/helpers/cron/cron';

import { BackupMode, BackupType, DataModel, RetryMode } from './Backup.types';
import { AddBackupFormProps } from './components/AddBackupPage/AddBackupPage.types';

const BASE_URL = '/v1/backups';

export const BackupService = {
  backup(values: AddBackupFormProps, token?: CancelToken) {
    const {
      id,
      service,
      location,
      period,
      month,
      day,
      weekDay,
      startHour,
      startMinute,
      backupName,
      description,
      retryMode,
      retryInterval,
      retryTimes,
      active,
      retention,
      mode,
      type,
      dataModel,
      folder,
    } = values;
    const strRetryInterval = `${retryInterval}s`;
    const resultRetryTimes = retryMode === RetryMode.MANUAL ? 0 : retryTimes;

    if (type === BackupType.DEMAND) {
      return this.triggerBackup(
        service!.value?.id || '',
        location!.value || '',
        backupName,
        description ?? '',
        strRetryInterval,
        resultRetryTimes!,
        dataModel,
        folder,
        token
      );
    } else {
      const cronExpression = getCronStringFromValues(
        period!.value!,
        month!.map((m) => m.value!),
        day!.map((m) => m.value!),
        weekDay!.map((m) => m.value!),
        startHour!.map((m) => m.value!),
        startMinute!.map((m) => m.value!)
      );
      if (id) {
        return this.changeScheduleBackup(
          id,
          active!,
          cronExpression,
          backupName,
          description ?? '',
          strRetryInterval,
          resultRetryTimes!,
          retention!
        );
      } else {
        return this.scheduleBackup(
          service!.value?.id!,
          location!.value!,
          cronExpression,
          backupName,
          description ?? '',
          strRetryInterval,
          resultRetryTimes!,
          retention!,
          active!,
          mode,
          dataModel,
          folder
        );
      }
    }
  },
  async triggerBackup(
    serviceId: string,
    locationId: string,
    name: string,
    description: string,
    retryInterval: string,
    retryTimes: number,
    dataModel: DataModel,
    folder: string,
    token?: CancelToken
  ) {
    return api.post(
      `${BASE_URL}:start`,
      {
        service_id: serviceId,
        location_id: locationId,
        name,
        description,
        retry_interval: retryInterval,
        retries: retryTimes,
        data_model: dataModel,
        folder,
      },
      false,
      token
    );
  },
  async scheduleBackup(
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
    dataModel: DataModel,
    folder: string
  ) {
    return api.post(`${BASE_URL}:schedule`, {
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
      folder,
    });
  },
  async changeScheduleBackup(
    id: string,
    enabled: boolean,
    cronExpression: string,
    name: string,
    description: string,
    retryInterval: string,
    retryTimes: number,
    retention: number
  ) {
    return api.put(`${BASE_URL}:changeScheduled`, {
      scheduled_backup_id: id,
      enabled,
      cron_expression: cronExpression,
      name,
      description,
      retry_interval: retryInterval,
      retries: retryTimes,
      retention,
    });
  },
};
