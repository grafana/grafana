import { __awaiter } from "tslib";
import { getBackendSrv } from '@grafana/runtime';
export const getServerStats = () => __awaiter(void 0, void 0, void 0, function* () {
    return getBackendSrv()
        .get('api/admin/stats')
        .catch((err) => {
        console.error(err);
        return null;
    });
});
//# sourceMappingURL=apis.js.map