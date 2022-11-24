import { Messages } from './Backup.messages';
import { DataModel, BackupStatus, RestoreStatus, BackupMode } from './Backup.types';
import { formatStatus, formatDataModel, formatBackupMode } from './Backup.utils';

const { status: statusMsg, dataModel: dataModelMsg, backupMode: backupModeMsg } = Messages;

describe('Backup::utils', () => {
  describe('formatStatus', () => {
    it('should correctly format status', () => {
      expect(formatStatus(BackupStatus.BACKUP_STATUS_INVALID)).toBe(statusMsg.invalid);
      expect(formatStatus(RestoreStatus.RESTORE_STATUS_IN_PROGRESS)).toBe(statusMsg.inProgress);
      expect(formatStatus(RestoreStatus.RESTORE_STATUS_ERROR)).toBe(statusMsg.error);
      expect(formatStatus(BackupStatus.BACKUP_STATUS_FAILED_NOT_SUPPORTED_BY_AGENT)).toBe(statusMsg.error);
      expect(formatStatus('bla' as RestoreStatus)).toBe(statusMsg.error);
    });
  });

  describe('formatDataModel', () => {
    it('should correctly format status', () => {
      expect(formatDataModel(DataModel.DATA_MODEL_INVALID)).toBe(dataModelMsg.invalid);
      expect(formatDataModel(DataModel.LOGICAL)).toBe(dataModelMsg.logical);
      expect(formatDataModel(DataModel.PHYSICAL)).toBe(dataModelMsg.physical);
      expect(formatDataModel('bla' as DataModel)).toBe('');
    });
  });

  describe('formatBackupMode', () => {
    it('should correctly format backup mode', () => {
      expect(formatBackupMode(BackupMode.INVALID)).toBe(backupModeMsg.invalid);
      expect(formatBackupMode('bla' as BackupMode)).toBe(backupModeMsg.invalid);
    });
  });
});
