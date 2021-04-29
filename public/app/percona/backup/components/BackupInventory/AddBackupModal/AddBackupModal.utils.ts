import { SelectableValue } from '@grafana/data';
import { DataModel } from 'app/percona/backup/Backup.types';
import { Backup } from '../BackupInventory.types';
import { AddBackupFormProps, RetryMode, SelectableService } from './AddBackupModal.types';

export const toFormBackup = (backup: Backup | null): AddBackupFormProps => {
  if (!backup) {
    return {
      service: (null as unknown) as SelectableValue<SelectableService>,
      dataModel: DataModel.PHYSICAL,
      backupName: '',
      description: '',
      location: (null as unknown) as SelectableValue<string>,
      retryMode: RetryMode.AUTO,
      retryTimes: 0,
      retryInterval: 0,
    };
  }

  const { serviceName, serviceId, vendor, dataModel, locationName, locationId } = backup;

  return {
    service: { label: serviceName, value: { id: serviceId, vendor } },
    dataModel,
    backupName: '',
    description: '',
    location: { label: locationName, value: locationId },
    retryMode: RetryMode.AUTO,
    retryTimes: 0,
    retryInterval: 0,
  };
};
