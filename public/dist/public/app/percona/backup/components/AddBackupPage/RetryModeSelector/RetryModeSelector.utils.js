import { RetryMode } from 'app/percona/backup/Backup.types';
import validators from 'app/percona/shared/helpers/validators';
import { MAXIMUM_RETRY, MAXIMUM_RETRY_TIME, MINIMUM_RETRY, MINIMUM_RETRY_TIME } from './RetryModeSelector.constants';
export const retryTimesValidator = (value, { retryMode }) => retryMode === RetryMode.MANUAL
    ? undefined
    : validators.required(value) || validators.range(MINIMUM_RETRY, MAXIMUM_RETRY)(value);
export const retryIntervalValidator = (value, { retryMode }) => retryMode === RetryMode.MANUAL
    ? undefined
    : validators.required(value) || validators.range(MINIMUM_RETRY_TIME, MAXIMUM_RETRY_TIME)(value);
//# sourceMappingURL=RetryModeSelector.utils.js.map