import { getHours, getMinutes, getSeconds, isSameDay } from 'date-fns';

import { formatDataModel } from 'app/percona/backup/Backup.utils';
import { DATABASE_LABELS } from 'app/percona/shared/core';

import { Backup } from '../BackupInventory.types';

import { RestoreBackupFormProps, ServiceTypeSelect } from './RestoreBackupModal.types';

type ToFormProps = (props: Backup) => RestoreBackupFormProps;

export const toFormProps: ToFormProps = ({ vendor, serviceId, serviceName, dataModel }) => ({
  serviceType: ServiceTypeSelect.SAME,
  vendor: DATABASE_LABELS[vendor],
  service: { label: serviceName, value: serviceId },
  dataModel: formatDataModel(dataModel),
});

export const isSameDayFromDate = (firstDay: Date | string, secondDay: Date | string) =>
  isSameDay(new Date(firstDay), new Date(secondDay));

export const getHoursFromDate = (date: string) => getHours(new Date(date));
export const getMinutesFromDate = (date: string) => getMinutes(new Date(date));
export const getSecondsFromDate = (date: string) => getSeconds(new Date(date));
