import { DataModel, RetryMode } from 'app/percona/backup/Backup.types';
import { Databases, DATABASE_LABELS } from 'app/percona/shared/core';
import { capitalizeText } from 'app/percona/shared/helpers/capitalizeText';
import { MONTHS, WEEKDAYS } from 'app/percona/shared/helpers/cron/constants';
import { Messages } from './AddBackupPage.messages';
import { getOptionFromDigit } from './AddBackupPage.utils';
export const SCHEDULED_TYPE = 'scheduled_task_id';
export const VENDOR_OPTIONS = [
    {
        value: Databases.mysql,
        label: DATABASE_LABELS.mysql,
    },
    {
        value: Databases.mongodb,
        label: DATABASE_LABELS.mongodb,
    },
    {
        value: Databases.postgresql,
        label: DATABASE_LABELS.postgresql,
    },
    {
        value: Databases.proxysql,
        label: DATABASE_LABELS.proxysql,
    },
];
export const DATA_MODEL_OPTIONS = [
    {
        value: DataModel.PHYSICAL,
        label: 'Physical',
    },
    {
        value: DataModel.LOGICAL,
        label: 'Logical',
    },
];
export const PAGE_SWITCHER_OPTIONS = [
    { value: 'demand', label: Messages.onDemand },
    {
        value: 'scheduled',
        label: Messages.schedule,
    },
];
export const RETRY_MODE_OPTIONS = [
    {
        value: RetryMode.AUTO,
        label: 'Auto',
    },
    {
        value: RetryMode.MANUAL,
        label: 'Manual',
    },
];
export const MONTH_OPTIONS = MONTHS.map((month, idx) => ({
    value: idx + 1,
    label: capitalizeText(month),
}));
export const DAY_OPTIONS = Array.from(Array(31).keys()).map((value) => getOptionFromDigit(value + 1));
export const WEEKDAY_OPTIONS = WEEKDAYS.map((day, idx) => ({
    value: idx,
    label: capitalizeText(day),
}));
export const HOUR_OPTIONS = Array.from(Array(24).keys()).map((value) => getOptionFromDigit(value));
export const MINUTE_OPTIONS = Array.from(Array(60).keys()).map((value) => getOptionFromDigit(value));
export const MAX_VISIBLE_OPTIONS = 4;
export const MIN_RETENTION = 0;
export const MAX_RETENTION = 99;
export const MAX_BACKUP_NAME = 100;
//# sourceMappingURL=AddBackupPage.constants.js.map