import { SelectableValue } from '@grafana/data';
import { BackupMode, BackupType, DataModel, RetryMode } from 'app/percona/backup/Backup.types';
import { ApiVerboseError, Databases } from 'app/percona/shared/core';

import { Backup } from '../BackupInventory/BackupInventory.types';
import { ScheduledBackup } from '../ScheduledBackups/ScheduledBackups.types';

import { ScheduledSectionFieldsValuesProps } from './ScheduleSection/ScheduleSectionFields/ScheduleSectionFields.types';

export interface AddBackupModalProps {
  backup: Backup | ScheduledBackup | null;
  isVisible: boolean;
  scheduleMode?: boolean;
  backupErrors?: ApiVerboseError[];
  onClose: () => void;
  onBackup: (values: AddBackupFormProps) => void;
}

export interface SelectableService {
  vendor: Databases;
  id: string;
}

export interface AddBackupFormProps extends ScheduledSectionFieldsValuesProps {
  id: string;
  service: SelectableValue<SelectableService> | null;
  dataModel: DataModel;
  backupName: string;
  description?: string;
  location: SelectableValue<string> | null;
  retention?: number;
  retryMode?: RetryMode;
  retryTimes?: number;
  retryInterval?: number;
  logs?: boolean;
  active?: boolean;
  vendor: Databases | null;
  mode: BackupMode;
  type: BackupType;
}
