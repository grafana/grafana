import { __awaiter } from "tslib";
import { api } from 'app/percona/shared/helpers/api';
const BASE_URL = '/v1/management/backup/Backups';
export const ScheduledBackupsService = {
    list(token) {
        return __awaiter(this, void 0, void 0, function* () {
            const { scheduled_backups = [] } = yield api.post(`${BASE_URL}/ListScheduled`, {}, false, token);
            return scheduled_backups.map(({ scheduled_backup_id, name, vendor, start_time, cron_expression, location_id, location_name, service_id, service_name, last_run, data_model, description, retries, retry_interval, enabled, retention = 0, mode, folder, }) => ({
                id: scheduled_backup_id,
                name,
                vendor,
                start: new Date(start_time).getTime(),
                retention,
                cronExpression: cron_expression,
                locationId: location_id,
                locationName: location_name,
                serviceId: service_id,
                serviceName: service_name,
                lastBackup: last_run ? new Date(last_run).getTime() : undefined,
                dataModel: data_model,
                description,
                mode,
                retryTimes: retries,
                retryInterval: retry_interval,
                enabled: !!enabled,
                folder,
            }));
        });
    },
    schedule(serviceId, locationId, cronExpression, name, description, retryInterval, retryTimes, retention, enabled, mode, dataModel) {
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
            });
        });
    },
    toggle(id, enabled) {
        return __awaiter(this, void 0, void 0, function* () {
            return api.post(`${BASE_URL}/ChangeScheduled`, { scheduled_backup_id: id, enabled });
        });
    },
    delete(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return api.post(`${BASE_URL}/RemoveScheduled`, { scheduled_backup_id: id });
        });
    },
};
//# sourceMappingURL=ScheduledBackups.service.js.map