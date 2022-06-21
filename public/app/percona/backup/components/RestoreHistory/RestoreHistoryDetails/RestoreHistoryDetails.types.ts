import { DataModel } from 'app/percona/backup/Backup.types';

export interface RestoreHistoryDetailsProps {
  name: string;
  finished: number;
  dataModel: DataModel;
}
