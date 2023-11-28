import { __awaiter } from "tslib";
import { api } from 'app/percona/shared/helpers/api';
const BASE_URL = '/v1/management/backup/Locations';
export const StorageLocationsService = {
    list(token) {
        return __awaiter(this, void 0, void 0, function* () {
            return api.post(`${BASE_URL}/List`, {});
        });
    },
    add(payload, token) {
        return __awaiter(this, void 0, void 0, function* () {
            return api.post(`${BASE_URL}/Add`, payload, false, token);
        });
    },
    update(payload, token) {
        return __awaiter(this, void 0, void 0, function* () {
            return api.post(`${BASE_URL}/Change`, payload, false, token);
        });
    },
    testLocation(payload, token) {
        return __awaiter(this, void 0, void 0, function* () {
            return api.post(`${BASE_URL}/TestConfig`, payload, false, token);
        });
    },
    delete(locationID, force, token) {
        return __awaiter(this, void 0, void 0, function* () {
            return api.post(`${BASE_URL}/Remove`, { location_id: locationID, force });
        });
    },
};
//# sourceMappingURL=StorageLocations.service.js.map