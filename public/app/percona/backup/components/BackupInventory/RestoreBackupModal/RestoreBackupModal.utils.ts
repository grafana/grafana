import { DATABASE_LABELS } from 'app/percona/shared/core';
import { Backup } from '../BackupInventory.types';
import { formatDataModel } from '../BackupInventory.utils';
import { RestoreBackupFormProps, ServiceTypeSelect } from './RestoreBackupModal.types';

type ToFormProps = (props: Backup) => RestoreBackupFormProps;

export const toFormProps: ToFormProps = ({ vendor, serviceId, serviceName, dataModel }) => ({
  serviceType: ServiceTypeSelect.SAME,
  vendor: DATABASE_LABELS[vendor],
  service: { label: serviceName, value: serviceId },
  dataModel: formatDataModel(dataModel),
});
