import { stubs as backupStubs } from '../__mocks__/BackupInventory.service';
import { DataModel } from '../BackupInventory.types';
import { AddBackupFormProps, RetryMode } from './AddBackupModal.types';
import { toFormBackup } from './AddBackupModal.utils';

describe('AddBackupModal::utils', () => {
  describe('toFormBackup', () => {
    it('should return default values if a null Backup is passed', () => {
      expect(toFormBackup(null)).toEqual<AddBackupFormProps>({
        service: null as any,
        dataModel: DataModel.PHYSICAL,
        backupName: '',
        description: '',
        location: null as any,
        retryMode: RetryMode.AUTO,
        retryTimes: 0,
        retryInterval: 0,
      });
    });

    it('should convert to form props', () => {
      const backup = backupStubs[0];
      const { serviceName, serviceId, vendor, dataModel, locationName, locationId } = backup;

      expect(toFormBackup(backup)).toEqual<AddBackupFormProps>({
        service: { label: serviceName, value: { id: serviceId, vendor } },
        dataModel,
        backupName: '',
        description: '',
        location: { label: locationName, value: locationId },
        retryMode: RetryMode.AUTO,
        retryTimes: 0,
        retryInterval: 0,
      });
    });
  });
});
