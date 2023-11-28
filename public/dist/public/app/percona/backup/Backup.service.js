import { __awaiter } from "tslib";
import { api } from 'app/percona/shared/helpers/api';
import { getCronStringFromValues } from '../shared/helpers/cron/cron';
import { BackupType, RetryMode } from './Backup.types';
const BASE_URL = '/v1/management/backup/Backups';
export const BackupService = {
    backup(values, token) {
        var _a, _b;
        const { id, service, location, period, month, day, weekDay, startHour, startMinute, backupName, description, retryMode, retryInterval, retryTimes, active, retention, mode, type, dataModel, folder, } = values;
        const strRetryInterval = `${retryInterval}s`;
        const resultRetryTimes = retryMode === RetryMode.MANUAL ? 0 : retryTimes;
        if (type === BackupType.DEMAND) {
            return this.triggerBackup(((_a = service.value) === null || _a === void 0 ? void 0 : _a.id) || '', location.value || '', backupName, description !== null && description !== void 0 ? description : '', strRetryInterval, resultRetryTimes, dataModel, folder, token);
        }
        else {
            const cronExpression = getCronStringFromValues(period.value, month.map((m) => m.value), day.map((m) => m.value), weekDay.map((m) => m.value), startHour.map((m) => m.value), startMinute.map((m) => m.value));
            if (id) {
                return this.changeScheduleBackup(id, active, cronExpression, backupName, description !== null && description !== void 0 ? description : '', strRetryInterval, resultRetryTimes, retention);
            }
            else {
                return this.scheduleBackup((_b = service.value) === null || _b === void 0 ? void 0 : _b.id, location.value, cronExpression, backupName, description !== null && description !== void 0 ? description : '', strRetryInterval, resultRetryTimes, retention, active, mode, dataModel, folder);
            }
        }
    },
    triggerBackup(serviceId, locationId, name, description, retryInterval, retryTimes, dataModel, folder, token) {
        return __awaiter(this, void 0, void 0, function* () {
            return api.post(`${BASE_URL}/Start`, {
                service_id: serviceId,
                location_id: locationId,
                name,
                description,
                retry_interval: retryInterval,
                retries: retryTimes,
                data_model: dataModel,
                folder,
            }, false, token);
        });
    },
    scheduleBackup(serviceId, locationId, cronExpression, name, description, retryInterval, retryTimes, retention, enabled, mode, dataModel, folder) {
        return __awaiter(this, void 0, void 0, function* () {
            return api.post(`${BASE_URL}/Schedule`, {
                service_id: serviceId,
                location_id: locationId,
                cron_expression: cronExpression,
                name,
                description,
                retry_interval: retryInterval,
                retries: retryTimes,
                enabled: !!enabled,
                retention,
                mode,
                data_model: dataModel,
                folder,
            });
        });
    },
    changeScheduleBackup(id, enabled, cronExpression, name, description, retryInterval, retryTimes, retention) {
        return __awaiter(this, void 0, void 0, function* () {
            return api.post(`${BASE_URL}/ChangeScheduled`, {
                scheduled_backup_id: id,
                enabled,
                cron_expression: cronExpression,
                name,
                description,
                retry_interval: retryInterval,
                retries: retryTimes,
                retention,
            });
        });
    },
};
//# sourceMappingURL=Backup.service.js.map