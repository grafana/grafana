import { SelectableValue } from '@grafana/data';
import { DataModel, RetryMode } from 'app/percona/backup/Backup.types';
import { DATABASE_LABELS } from 'app/percona/shared/core';
import { getPeriodFromCronparts, parseCronString } from 'app/percona/shared/helpers/cron/cron';
import { PeriodType } from 'app/percona/shared/helpers/cron/types';
import { Backup } from '../BackupInventory/BackupInventory.types';
import { ScheduledBackup } from '../ScheduledBackups/ScheduledBackups.types';
import { AddBackupFormProps, SelectableService } from './AddBackupModal.types';

export const PERIOD_OPTIONS: Array<SelectableValue<PeriodType>> = [
  {
    value: 'year',
    label: 'Year',
  },
  {
    value: 'month',
    label: 'Month',
  },
  {
    value: 'week',
    label: 'Week',
  },
  {
    value: 'day',
    label: 'Day',
  },
  {
    value: 'hour',
    label: 'Hour',
  },
  {
    value: 'minute',
    label: 'Minute',
  },
];

const isScheduledBackup = (backup: Backup | ScheduledBackup): backup is ScheduledBackup =>
  (backup as ScheduledBackup).cronExpression !== undefined;

export const toFormBackup = (backup: Backup | ScheduledBackup | null): AddBackupFormProps => {
  if (!backup) {
    return {
      id: '',
      service: (null as unknown) as SelectableValue<SelectableService>,
      dataModel: DataModel.PHYSICAL,
      vendor: '',
      retryMode: RetryMode.MANUAL,
      retryTimes: 2,
      retryInterval: 30,
      backupName: '',
      description: '',
      location: (null as unknown) as SelectableValue<string>,
      retention: 7,
      period: { value: 'year', label: 'Year' },
      month: [],
      day: [],
      weekDay: [],
      startHour: [{ value: 0, label: '00' }],
      startMinute: [{ value: 0, label: '00' }],
      logs: false,
      active: true,
    };
  }

  const { name, serviceName, serviceId, vendor, dataModel, locationName, locationId, id } = backup;
  const vendorValue = DATABASE_LABELS[vendor];

  let month: Array<SelectableValue<number>> = [];
  let day: Array<SelectableValue<number>> = [];
  let weekDay: Array<SelectableValue<number>> = [];
  let startHour: Array<SelectableValue<number>> = [];
  let startMinute: Array<SelectableValue<number>> = [];
  let period: SelectableValue<PeriodType> = PERIOD_OPTIONS[0];
  let active = false;
  let description = '';

  if (isScheduledBackup(backup)) {
    const { cronExpression, enabled, description: backupDescription, retention, retryInterval, retryTimes } = backup;
    const cronParts = parseCronString(cronExpression);
    const periodType = getPeriodFromCronparts(cronParts);
    const [minutePart, hourPart, dayPart, monthPart, weekDayPary] = cronParts;
    active = enabled;
    description = backupDescription;
    startMinute = minutePart.map((v) => getOptionFromDigit(v));
    startHour = hourPart.map((v) => getOptionFromDigit(v));
    day = dayPart.map((v) => getOptionFromDigit(v));
    month = monthPart.map((v) => getOptionFromDigit(v));
    weekDay = weekDayPary.map((v) => getOptionFromDigit(v));
    period = getOptionFromPeriodType(periodType);

    return {
      id,
      service: { label: serviceName, value: { id: serviceId, vendor } },
      dataModel,
      vendor: vendorValue,
      backupName: name,
      description,
      location: { label: locationName, value: locationId },
      retryMode: retryTimes > 0 ? RetryMode.AUTO : RetryMode.MANUAL,
      retryTimes: retryTimes || 2,
      retryInterval: parseInt(retryInterval || '30', 10),
      retention,
      period,
      month,
      day,
      weekDay,
      startHour,
      startMinute,
      logs: false,
      active,
    };
  } else {
    return {
      id,
      service: { label: serviceName, value: { id: serviceId, vendor } },
      dataModel,
      vendor: vendorValue,
      backupName: name,
      description,
      location: { label: locationName, value: locationId },
      retryMode: RetryMode.MANUAL,
      retryTimes: 2,
      retryInterval: 30,
    };
  }
};

type BackupFormTimeProps = keyof Pick<AddBackupFormProps, 'month' | 'day' | 'weekDay' | 'startHour' | 'startMinute'>;
export const isCronFieldDisabled = (period: PeriodType, field: BackupFormTimeProps) => {
  const map: Record<PeriodType, BackupFormTimeProps[]> = {
    year: [],
    month: ['month'],
    week: ['month', 'day'],
    day: ['month', 'day', 'weekDay'],
    hour: ['month', 'day', 'weekDay', 'startHour'],
    minute: ['month', 'day', 'weekDay', 'startHour', 'startMinute'],
  };

  return map[period].includes(field);
};

export const getOptionFromPeriodType = (period: PeriodType): SelectableValue<PeriodType> =>
  PERIOD_OPTIONS.find((p) => p.value === period)!;

export const getOptionFromDigit = (value: number): SelectableValue<number> => ({
  value,
  label: value < 10 ? `0${value.toString()}` : value.toString(),
});
