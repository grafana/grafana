import { Messages } from './Backup.messages';
import { BackupMode, BackupStatus, DataModel, RestoreStatus } from './Backup.types';
const { status: statusMsg, dataModel: dataModelMsg, backupMode: backupModeMsg } = Messages;
export const formatStatus = (status) => {
    var _a;
    const map = {
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
    return (_a = map[status]) !== null && _a !== void 0 ? _a : statusMsg.error;
};
export const formatDataModel = (model) => {
    var _a;
    const map = {
        [DataModel.DATA_MODEL_INVALID]: dataModelMsg.invalid,
        [DataModel.PHYSICAL]: dataModelMsg.physical,
        [DataModel.LOGICAL]: dataModelMsg.logical,
    };
    return (_a = map[model]) !== null && _a !== void 0 ? _a : '';
};
export const formatBackupMode = (mode) => {
    const map = {
        [BackupMode.SNAPSHOT]: backupModeMsg.full,
        [BackupMode.INCREMENTAL]: backupModeMsg.incremental,
        [BackupMode.PITR]: backupModeMsg.pitr,
        [BackupMode.INVALID]: backupModeMsg.invalid,
    };
    return map[mode] || map[BackupMode.INVALID];
};
export const formatLocationsToMap = (locations) => locations.reduce((map, obj) => ((map[obj.locationID] = obj), map), {});
//# sourceMappingURL=Backup.utils.js.map