import { RestoreStatus, BackupStatus } from '../../Backup.types';

export interface StatusProps {
  status: BackupStatus | RestoreStatus;
  showLogsAction?: boolean;
  onLogClick?: () => void;
}
