import { __awaiter } from "tslib";
import { api } from 'app/percona/shared/helpers/api';
const BASE_URL = '/v1/management/backup';
export const RestoreHistoryService = {
    list(token) {
        return __awaiter(this, void 0, void 0, function* () {
            const { items = [] } = yield api.post(`${BASE_URL}/RestoreHistory/List`, {}, false, token);
            return items.map(({ restore_id, artifact_id, name, vendor, location_id, location_name, service_id, service_name, data_model, status, started_at, finished_at, pitr_timestamp, }) => ({
                id: restore_id,
                artifactId: artifact_id,
                name,
                vendor,
                locationId: location_id,
                locationName: location_name,
                serviceId: service_id,
                serviceName: service_name,
                dataModel: data_model,
                status,
                started: new Date(started_at).getTime(),
                finished: finished_at ? new Date(finished_at).getTime() : null,
                pitrTimestamp: pitr_timestamp ? new Date(pitr_timestamp).getTime() : undefined,
            }));
        });
    },
    getLogs(restoreId, offset, limit, token) {
        return __awaiter(this, void 0, void 0, function* () {
            const { logs = [], end } = yield api.post(`${BASE_URL}/Backups/GetLogs`, {
                restore_id: restoreId,
                offset,
                limit,
            }, false, token);
            return {
                logs: logs.map(({ chunk_id = 0, data, time }) => ({ id: chunk_id, data, time })),
                end,
            };
        });
    },
};
//# sourceMappingURL=RestoreHistory.service.js.map