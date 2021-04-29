import { Messages } from './Backup.messages';
import { DataModel, RestoreStatus, BackupStatus } from './Backup.types';

const { status: statusMsg, dataModel: dataModelMsg } = Messages;

export const formatStatus = (status: BackupStatus | RestoreStatus): string => {
  const map: Record<BackupStatus | RestoreStatus, string> = {
    [BackupStatus.BACKUP_STATUS_INVALID]: statusMsg.invalid,
    [RestoreStatus.RESTORE_STATUS_INVALID]: statusMsg.invalid,
    [BackupStatus.BACKUP_STATUS_PENDING]: statusMsg.pending,
    [BackupStatus.BACKUP_STATUS_IN_PROGRESS]: statusMsg.inProgress,
    [RestoreStatus.RESTORE_STATUS_IN_PROGRESS]: statusMsg.inProgress,
    [BackupStatus.BACKUP_STATUS_PAUSED]: statusMsg.paused,
    [BackupStatus.BACKUP_STATUS_SUCCESS]: statusMsg.success,
    [RestoreStatus.RESTORE_STATUS_SUCCESS]: statusMsg.success,
    [BackupStatus.BACKUP_STATUS_ERROR]: statusMsg.error,
    [RestoreStatus.RESTORE_STATUS_ERROR]: statusMsg.error,
  };

  return map[status] ?? '';
};

export const formatDataModel = (model: DataModel): string => {
  const map: Record<DataModel, string> = {
    [DataModel.DATA_MODEL_INVALID]: dataModelMsg.invalid,
    [DataModel.PHYSICAL]: dataModelMsg.physical,
    [DataModel.LOGICAL]: dataModelMsg.logical,
  };

  return map[model] ?? '';
};
