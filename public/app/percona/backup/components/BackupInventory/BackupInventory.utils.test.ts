import { DataModel, Status } from './BackupInventory.types';
import { formatStatus, formatDataModel } from './BackupInventory.utils';
import { Messages } from './BackupInventory.messages';

const { status: statusMsg, dataModel: dataModelMsg } = Messages;

describe('BackupInventory::utils', () => {
  describe('formatStatus', () => {
    it('should correctly format status', () => {
      expect(formatStatus(Status.STATUS_INVALID)).toBe(statusMsg.invalid);
      expect(formatStatus(Status.IN_PROGRESS)).toBe(statusMsg.inProgress);
      expect(formatStatus(Status.ERROR)).toBe(statusMsg.error);
      expect(formatStatus('bla' as Status)).toBe('');
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
