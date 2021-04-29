import { Databases } from 'app/percona/shared/core';
import { DataModel, BackupStatus } from '../../Backup.types';
export interface Backup {
  id: string;
  name: string;
  created: number;
  locationId: string;
  locationName: string;
  serviceId: string;
  serviceName: string;
  dataModel: DataModel;
  status: BackupStatus;
  vendor: Databases;
}

export interface RawBackup {
  artifact_id: string;
  name: string;
  location_id: string;
  location_name: string;
  created_at: string;
  service_id: string;
  service_name: string;
  data_model: DataModel;
  status: BackupStatus;
  vendor: Databases;
}

export interface BackupResponse {
  artifacts: RawBackup[];
}
