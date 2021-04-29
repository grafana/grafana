import { SelectableValue } from '@grafana/data';
import { DataModel } from 'app/percona/backup/Backup.types';
import { Databases } from 'app/percona/shared/core';
import { Backup } from '../BackupInventory.types';

export interface AddBackupModalProps {
  backup: Backup | null;
  isVisible: boolean;
  onClose: () => void;
  onBackup: (values: AddBackupFormProps) => void;
}

export enum RetryMode {
  AUTO = 'AUTO',
  MANUAL = 'MANUAL',
}

export interface SelectableService {
  vendor: Databases;
  id: string;
}

export interface AddBackupFormProps {
  service: SelectableValue<SelectableService>;
  dataModel: DataModel;
  backupName: string;
  description: string;
  location: SelectableValue<string>;
  retryMode: RetryMode;
  retryTimes: number;
  retryInterval: number;
}
