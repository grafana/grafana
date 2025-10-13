import { Databases } from 'app/percona/shared/core';

import { DataModel, BackupStatus, BackupMode } from '../../Backup.types';
import { StorageLocation } from '../StorageLocations/StorageLocations.types';

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
  mode: BackupMode;
  folder: string;
  type?: Databases | 'external';
}

export interface BackupRow extends Backup {
  location?: StorageLocation;
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
  mode: BackupMode;
  folder: string;
}

export interface BackupResponse {
  artifacts: RawBackup[];
}

export interface RawTimeranges {
  start_timestamp: string;
  end_timestamp: string;
}

export interface Timeranges {
  startTimestamp: string;
  endTimestamp: string;
}

export interface TimerangesResponse {
  timeranges: RawTimeranges[];
}
