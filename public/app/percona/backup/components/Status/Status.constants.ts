import { BackupStatus, RestoreStatus } from '../../Backup.types';

export const pendingStates = [
  BackupStatus.BACKUP_STATUS_PENDING,
  BackupStatus.BACKUP_STATUS_IN_PROGRESS,
  RestoreStatus.RESTORE_STATUS_IN_PROGRESS,
];

export const successfulStates = [BackupStatus.BACKUP_STATUS_SUCCESS, RestoreStatus.RESTORE_STATUS_SUCCESS];
export const errorStates = [
  BackupStatus.BACKUP_STATUS_ERROR,
  RestoreStatus.RESTORE_STATUS_ERROR,
  BackupStatus.BACKUP_STATUS_INVALID,
  BackupStatus.BACKUP_STATUS_FAILED_NOT_SUPPORTED_BY_AGENT,
  RestoreStatus.RESTORE_STATUS_INVALID,
];
