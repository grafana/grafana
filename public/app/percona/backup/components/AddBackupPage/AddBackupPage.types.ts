import { SelectableValue } from '@grafana/data';
import { BackupMode, BackupType, DataModel, RetryMode } from 'app/percona/backup/Backup.types';
import { ApiVerboseError, Databases } from 'app/percona/shared/core';
import { PeriodType } from 'app/percona/shared/helpers/cron/types';

import { Backup } from '../BackupInventory/BackupInventory.types';
import { ScheduledBackup } from '../ScheduledBackups/ScheduledBackups.types';

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

export interface AddBackupFormProps {
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
  period?: SelectableValue<PeriodType>;
  month?: Array<SelectableValue<number>>;
  day?: Array<SelectableValue<number>>;
  weekDay?: Array<SelectableValue<number>>;
  startHour?: Array<SelectableValue<number>>;
  startMinute?: Array<SelectableValue<number>>;
  logs?: boolean;
  active?: boolean;
  vendor: Databases | null;
  mode: BackupMode;
  type: BackupType;
}
