import { DataModel } from 'app/percona/backup/Backup.types';

export interface RestoreHistoryDetailsProps {
  name: string;
  dataModel: DataModel;
  pitrTimestamp?: number;
}
