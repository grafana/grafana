import { DataModel, BackupStatus, RestoreStatus } from './Backup.types';
import { formatStatus, formatDataModel } from './Backup.utils';
import { Messages } from './Backup.messages';

const { status: statusMsg, dataModel: dataModelMsg } = Messages;

describe('Backup::utils', () => {
  describe('formatStatus', () => {
    it('should correctly format status', () => {
      expect(formatStatus(BackupStatus.BACKUP_STATUS_INVALID)).toBe(statusMsg.invalid);
      expect(formatStatus(RestoreStatus.RESTORE_STATUS_IN_PROGRESS)).toBe(statusMsg.inProgress);
      expect(formatStatus(RestoreStatus.RESTORE_STATUS_ERROR)).toBe(statusMsg.error);
      expect(formatStatus('bla' as RestoreStatus)).toBe('');
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
});
