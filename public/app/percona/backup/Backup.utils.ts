import { Messages } from './Backup.messages';
import { DataModel, RestoreStatus, BackupStatus, BackupMode } from './Backup.types';

const { status: statusMsg, dataModel: dataModelMsg, backupMode: backupModeMsg } = Messages;

export const formatStatus = (status: BackupStatus | RestoreStatus): string => {
  const map: Record<BackupStatus | RestoreStatus, string> = {
    [BackupStatus.BACKUP_STATUS_INVALID]: statusMsg.invalid,
    [RestoreStatus.RESTORE_STATUS_INVALID]: statusMsg.invalid,
    [BackupStatus.BACKUP_STATUS_PENDING]: statusMsg.pending,
    [BackupStatus.BACKUP_STATUS_IN_PROGRESS]: statusMsg.inProgress,
    [BackupStatus.BACKUP_STATUS_DELETING]: statusMsg.deleting,
    [BackupStatus.BACKUP_STATUS_FAILED_TO_DELETE]: statusMsg.failedToDelete,
    [RestoreStatus.RESTORE_STATUS_IN_PROGRESS]: statusMsg.inProgress,
    [BackupStatus.BACKUP_STATUS_PAUSED]: statusMsg.paused,
    [BackupStatus.BACKUP_STATUS_SUCCESS]: statusMsg.success,
    [RestoreStatus.RESTORE_STATUS_SUCCESS]: statusMsg.success,
    [BackupStatus.BACKUP_STATUS_ERROR]: statusMsg.error,
    [BackupStatus.BACKUP_STATUS_FAILED_NOT_SUPPORTED_BY_AGENT]: statusMsg.error,
    [RestoreStatus.RESTORE_STATUS_ERROR]: statusMsg.error,
  };

  return map[status] ?? statusMsg.error;
};

export const formatDataModel = (model: DataModel): string => {
  const map: Record<DataModel, string> = {
    [DataModel.DATA_MODEL_INVALID]: dataModelMsg.invalid,
    [DataModel.PHYSICAL]: dataModelMsg.physical,
    [DataModel.LOGICAL]: dataModelMsg.logical,
  };

  return map[model] ?? '';
};

export const formatBackupMode = (mode: BackupMode): string => {
  const map: Record<BackupMode, string> = {
    [BackupMode.SNAPSHOT]: backupModeMsg.full,
    [BackupMode.INCREMENTAL]: backupModeMsg.incremental,
    [BackupMode.PITR]: backupModeMsg.pitr,
    [BackupMode.INVALID]: backupModeMsg.invalid,
  };

  return map[mode] || map[BackupMode.INVALID];
};
