export var DataModel;
(function (DataModel) {
    DataModel["DATA_MODEL_INVALID"] = "DATA_MODEL_INVALID";
    DataModel["PHYSICAL"] = "PHYSICAL";
    DataModel["LOGICAL"] = "LOGICAL";
})(DataModel || (DataModel = {}));
export var BackupStatus;
(function (BackupStatus) {
    BackupStatus["BACKUP_STATUS_INVALID"] = "BACKUP_STATUS_INVALID";
    BackupStatus["BACKUP_STATUS_PENDING"] = "BACKUP_STATUS_PENDING";
    BackupStatus["BACKUP_STATUS_IN_PROGRESS"] = "BACKUP_STATUS_IN_PROGRESS";
    BackupStatus["BACKUP_STATUS_PAUSED"] = "BACKUP_STATUS_PAUSED";
    BackupStatus["BACKUP_STATUS_SUCCESS"] = "BACKUP_STATUS_SUCCESS";
    BackupStatus["BACKUP_STATUS_ERROR"] = "BACKUP_STATUS_ERROR";
    BackupStatus["BACKUP_STATUS_DELETING"] = "BACKUP_STATUS_DELETING";
    BackupStatus["BACKUP_STATUS_FAILED_TO_DELETE"] = "BACKUP_STATUS_FAILED_TO_DELETE";
    BackupStatus["BACKUP_STATUS_FAILED_NOT_SUPPORTED_BY_AGENT"] = "BACKUP_STATUS_FAILED_NOT_SUPPORTED_BY_AGENT";
})(BackupStatus || (BackupStatus = {}));
export var RestoreStatus;
(function (RestoreStatus) {
    RestoreStatus["RESTORE_STATUS_INVALID"] = "RESTORE_STATUS_INVALID";
    RestoreStatus["RESTORE_STATUS_IN_PROGRESS"] = "RESTORE_STATUS_IN_PROGRESS";
    RestoreStatus["RESTORE_STATUS_SUCCESS"] = "RESTORE_STATUS_SUCCESS";
    RestoreStatus["RESTORE_STATUS_ERROR"] = "RESTORE_STATUS_ERROR";
})(RestoreStatus || (RestoreStatus = {}));
export var RetryMode;
(function (RetryMode) {
    RetryMode["AUTO"] = "AUTO";
    RetryMode["MANUAL"] = "MANUAL";
})(RetryMode || (RetryMode = {}));
export var BackupMode;
(function (BackupMode) {
    BackupMode["INVALID"] = "BACKUP_MODE_INVALID";
    BackupMode["SNAPSHOT"] = "SNAPSHOT";
    BackupMode["INCREMENTAL"] = "INCREMENTAL";
    BackupMode["PITR"] = "PITR";
})(BackupMode || (BackupMode = {}));
export var BackupType;
(function (BackupType) {
    BackupType["DEMAND"] = "DEMAND";
    BackupType["SCHEDULED"] = "SCHEDULED";
})(BackupType || (BackupType = {}));
//# sourceMappingURL=Backup.types.js.map