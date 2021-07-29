import { Databases } from 'app/percona/shared/core';
import { BackupType, DataModel } from '../../Backup.types';

export interface RawScheduledBackup {
  scheduled_backup_id: string;
  service_id: string;
  service_name: string;
  location_id: string;
  location_name: string;
  cron_expression: string;
  start_time: string;
  name: string;
  description: string;
  vendor: Databases;
  last_run?: string;
  data_model: DataModel;
  enabled: boolean;
  retention: number;
}

export interface ScheduledBackupResponse {
  scheduled_backups: RawScheduledBackup[];
}

export interface ScheduledBackup {
  id: string;
  name: string;
  locationId: string;
  locationName: string;
  serviceId: string;
  serviceName: string;
  vendor: Databases;
  start: number;
  retention: number;
  cronExpression: string;
  lastBackup?: number;
  dataModel: DataModel;
  description: string;
  type: BackupType;
  enabled: boolean;
}
