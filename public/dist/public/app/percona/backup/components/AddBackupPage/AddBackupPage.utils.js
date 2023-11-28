import { BackupMode, BackupType, DataModel, RetryMode } from 'app/percona/backup/Backup.types';
import { Databases } from 'app/percona/shared/core';
import { getPeriodFromCronparts, parseCronString } from 'app/percona/shared/helpers/cron/cron';
import { formatBackupMode } from '../../Backup.utils';
import { LocationType } from '../StorageLocations/StorageLocations.types';
import { ScheduleSectionFields as ScheduleSectionFieldsEnum, ScheduleSectionFields, } from './ScheduleSection/ScheduleSectionFields/ScheduleSectionFields.types';
export const PERIOD_OPTIONS = [
    {
        value: 'year',
        label: 'Every year',
    },
    {
        value: 'month',
        label: 'Every month',
    },
    {
        value: 'week',
        label: 'Every week',
    },
    {
        value: 'day',
        label: 'Every day',
    },
    {
        value: 'hour',
        label: 'Every hour',
    },
    {
        value: 'minute',
        label: 'Every minute',
    },
];
const isScheduledBackup = (backup) => backup.cronExpression !== undefined;
const getBackupType = (backup) => {
    if (backup && isScheduledBackup(backup)) {
        return BackupType.SCHEDULED;
    }
    return BackupType.DEMAND;
};
export const toFormBackup = (backup, scheduleMode) => {
    if (!backup) {
        return {
            id: '',
            service: null,
            dataModel: DataModel.PHYSICAL,
            retryMode: RetryMode.MANUAL,
            retryTimes: 2,
            retryInterval: 30,
            backupName: '',
            description: '',
            location: null,
            retention: 7,
            period: { value: 'year', label: 'Every year' },
            month: [],
            day: [],
            weekDay: [],
            startHour: [{ value: 0, label: '00' }],
            startMinute: [{ value: 0, label: '00' }],
            logs: false,
            active: true,
            vendor: null,
            mode: BackupMode.SNAPSHOT,
            type: scheduleMode ? BackupType.SCHEDULED : getBackupType(backup),
            folder: '',
        };
    }
    const { name, serviceName, serviceId, vendor, dataModel, locationName, locationId, id, mode, folder } = backup;
    let month = [];
    let day = [];
    let weekDay = [];
    let startHour = [];
    let startMinute = [];
    let period = PERIOD_OPTIONS[0];
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
            vendor,
            mode,
            type: BackupType.SCHEDULED,
            folder,
        };
    }
    else {
        return {
            id,
            mode,
            vendor,
            service: { label: serviceName, value: { id: serviceId, vendor } },
            dataModel,
            backupName: name,
            description,
            location: { label: locationName, value: locationId },
            retryMode: RetryMode.MANUAL,
            retryTimes: 2,
            retryInterval: 30,
            type: BackupType.DEMAND,
            folder,
        };
    }
};
export const isCronFieldDisabled = (period, field) => {
    const map = {
        year: [],
        month: [ScheduleSectionFieldsEnum.month],
        week: [ScheduleSectionFieldsEnum.month, ScheduleSectionFieldsEnum.day],
        day: [ScheduleSectionFieldsEnum.month, ScheduleSectionFieldsEnum.day, ScheduleSectionFieldsEnum.weekDay],
        hour: [
            ScheduleSectionFieldsEnum.month,
            ScheduleSectionFieldsEnum.day,
            ScheduleSectionFieldsEnum.weekDay,
            ScheduleSectionFields.startHour,
        ],
        minute: [
            ScheduleSectionFieldsEnum.month,
            ScheduleSectionFieldsEnum.day,
            ScheduleSectionFieldsEnum.weekDay,
            ScheduleSectionFields.startHour,
            ScheduleSectionFields.startMinute,
        ],
    };
    return map[period].includes(field);
};
export const getOptionFromPeriodType = (period) => PERIOD_OPTIONS.find((p) => p.value === period);
export const getOptionFromDigit = (value) => ({
    value,
    label: value < 10 ? `0${value.toString()}` : value.toString(),
});
export const getBackupModeOptions = (db) => {
    const pitrDbs = [Databases.mongodb];
    const isPitr = pitrDbs.includes(db);
    const modes = [isPitr ? BackupMode.PITR : BackupMode.INCREMENTAL, BackupMode.SNAPSHOT];
    return modes.map((mode) => ({
        value: mode,
        label: formatBackupMode(mode),
    }));
};
export const getDataModelFromVendor = (db) => {
    const logicalDbs = [Databases.mongodb];
    return logicalDbs.includes(db) ? DataModel.LOGICAL : DataModel.PHYSICAL;
};
export const isDataModelDisabled = (values) => { var _a, _b; return ((_b = (_a = values.service) === null || _a === void 0 ? void 0 : _a.value) === null || _b === void 0 ? void 0 : _b.vendor) === Databases.mysql || values.mode === BackupMode.PITR; };
export const getLabelForStorageOption = (type) => `${type}${type === LocationType.CLIENT ? ' (not available for MySQL)' : ''}`;
//# sourceMappingURL=AddBackupPage.utils.js.map