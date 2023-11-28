import { __awaiter } from "tslib";
import { api } from 'app/percona/shared/helpers/api';
const BASE_URL = '/v1/management/DBaaS/Backups';
export const DBaaSBackupService = {
    list(locationId) {
        return __awaiter(this, void 0, void 0, function* () {
            const { backups = [] } = yield api.post(`${BASE_URL}/List`, {
                location_id: locationId,
            }, false);
            return backups;
        });
    },
};
//# sourceMappingURL=DBaaSBackups.service.js.map