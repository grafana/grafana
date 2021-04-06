import { Databases } from 'app/percona/shared/core';

export enum DataModel {
  DATA_MODEL_INVALID = 'DATA_MODEL_INVALID',
  PHYSICAL = 'PHYSICAL',
  LOGICAL = 'LOGICAL',
}

export enum Status {
  STATUS_INVALID = 'STATUS_INVALID',
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  PAUSED = 'PAUSED',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
}

export interface Backup {
  id: string;
  name: string;
  created: number;
  locationId: string;
  locationName: string;
  serviceId: string;
  serviceName: string;
  dataModel: DataModel;
  status: Status;
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
  status: Status;
  vendor: Databases;
}

export interface BackupResponse {
  artifacts: RawBackup[];
}
