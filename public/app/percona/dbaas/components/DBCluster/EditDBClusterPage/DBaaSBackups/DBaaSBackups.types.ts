import { SelectableValue } from '@grafana/data';

export interface DBaaSBackupListResponse {
  backups: DBaaSBackup[];
}

export interface DBaaSBackup {
  key: string;
}

export enum DBaaSBackupFields {
  location = 'backupLocation',
  retention = 'retention',
}

export interface DBaaSBackupProps {
  [DBaaSBackupFields.location]?: SelectableValue<string>;
  [DBaaSBackupFields.retention]?: number;
}
