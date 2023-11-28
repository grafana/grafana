import { __awaiter } from "tslib";
import { api } from 'app/percona/shared/helpers/api';
import { formatDate } from './BackupInventory.utils';
const BASE_URL = '/v1/management/backup';
export const BackupInventoryService = {
    list(token) {
        return __awaiter(this, void 0, void 0, function* () {
            const { artifacts = [] } = yield api.post(`${BASE_URL}/Artifacts/List`, {}, false, token);
            return artifacts.map(({ artifact_id, name, location_id, location_name, created_at, service_id, service_name, data_model, status, vendor, mode, folder, }) => ({
                id: artifact_id,
                name,
                created: new Date(created_at).getTime(),
                locationId: location_id,
                locationName: location_name,
                serviceId: service_id,
                serviceName: service_name,
                dataModel: data_model,
                status,
                vendor,
                mode,
                folder,
            }));
        });
    },
    listPitrTimeranges(artifactId) {
        return __awaiter(this, void 0, void 0, function* () {
            const { timeranges = [] } = yield api.post(`${BASE_URL}/Artifacts/ListPITRTimeranges`, {
                artifact_id: artifactId,
            });
            return timeranges.map((value) => ({
                label: `${formatDate(value.start_timestamp)} / ${formatDate(value.end_timestamp)}`,
                value: { startTimestamp: value.start_timestamp, endTimestamp: value.end_timestamp },
            }));
        });
    },
    restore(serviceId, artifactId, pitrTimestamp, token) {
        return __awaiter(this, void 0, void 0, function* () {
            return api.post(`${BASE_URL}/Backups/Restore`, {
                service_id: serviceId,
                artifact_id: artifactId,
                pitr_timestamp: pitrTimestamp,
            }, false, token);
        });
    },
    backup(serviceId, locationId, name, description, retryInterval, retryTimes, dataModel, token) {
        return __awaiter(this, void 0, void 0, function* () {
            return api.post(`${BASE_URL}/Backups/Start`, {
                service_id: serviceId,
                location_id: locationId,
                name,
                description,
                retry_interval: retryInterval,
                retries: retryTimes,
                data_model: dataModel,
            }, false, token);
        });
    },
    delete(artifactId, removeFiles) {
        return __awaiter(this, void 0, void 0, function* () {
            return api.post(`${BASE_URL}/Artifacts/Delete`, { artifact_id: artifactId, remove_files: removeFiles });
        });
    },
    getLogs(artifactId, offset, limit, token) {
        return __awaiter(this, void 0, void 0, function* () {
            const { logs = [], end } = yield api.post(`${BASE_URL}/Backups/GetLogs`, {
                artifact_id: artifactId,
                offset,
                limit,
            }, false, token);
            return {
                logs: logs.map(({ chunk_id = 0, data, time }) => ({ id: chunk_id, data, time })),
                end,
            };
        });
    },
    listCompatibleServices(artifactId) {
        return __awaiter(this, void 0, void 0, function* () {
            const { mysql = [], mongodb = [] } = yield api.post(`${BASE_URL}/Backups/ListArtifactCompatibleServices`, {
                artifact_id: artifactId,
            });
            const result = {
                mysql: mysql.map(({ service_id, service_name }) => ({ id: service_id, name: service_name })),
                mongodb: mongodb.map(({ service_id, service_name }) => ({ id: service_id, name: service_name })),
            };
            return result;
        });
    },
};
//# sourceMappingURL=BackupInventory.service.js.map