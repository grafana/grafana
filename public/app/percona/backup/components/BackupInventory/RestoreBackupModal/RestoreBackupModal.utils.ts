import { DATABASE_LABELS } from 'app/percona/shared/core';
import { formatDataModel } from 'app/percona/backup/Backup.utils';
import { Backup } from '../BackupInventory.types';
import { RestoreBackupFormProps, ServiceTypeSelect } from './RestoreBackupModal.types';

type ToFormProps = (props: Backup) => RestoreBackupFormProps;

export const toFormProps: ToFormProps = ({ vendor, serviceId, serviceName, dataModel }) => ({
  serviceType: ServiceTypeSelect.SAME,
  vendor: DATABASE_LABELS[vendor],
  service: { label: serviceName, value: serviceId },
  dataModel: formatDataModel(dataModel),
});
