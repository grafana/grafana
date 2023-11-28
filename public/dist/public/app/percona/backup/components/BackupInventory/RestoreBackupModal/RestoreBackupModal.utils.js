import { getHours, getMinutes, getSeconds, isSameDay } from 'date-fns';
import { formatDataModel } from 'app/percona/backup/Backup.utils';
import { DATABASE_LABELS } from 'app/percona/shared/core';
import { ServiceTypeSelect } from './RestoreBackupModal.types';
export const toFormProps = ({ vendor, serviceId, serviceName, dataModel }) => ({
    serviceType: ServiceTypeSelect.SAME,
    vendor: DATABASE_LABELS[vendor],
    service: { label: serviceName, value: serviceId },
    dataModel: formatDataModel(dataModel),
});
export const isSameDayFromDate = (firstDay, secondDay) => isSameDay(new Date(firstDay), new Date(secondDay));
export const getHoursFromDate = (date) => getHours(new Date(date));
export const getMinutesFromDate = (date) => getMinutes(new Date(date));
export const getSecondsFromDate = (date) => getSeconds(new Date(date));
//# sourceMappingURL=RestoreBackupModal.utils.js.map