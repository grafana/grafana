import { BackupStatus, DataModel, RestoreStatus } from 'app/percona/backup/Backup.types';

export interface BackupInventoryDetailsProps {
  name: string;
  status: BackupStatus | RestoreStatus;
  dataModel: DataModel;
}
