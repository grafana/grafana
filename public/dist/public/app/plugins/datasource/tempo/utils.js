import { __awaiter } from "tslib";
import { getDataSourceSrv } from '@grafana/runtime';
export const getErrorMessage = (message, prefix) => {
    const err = message ? ` (${message})` : '';
    let errPrefix = prefix ? prefix : 'Error';
    return `${errPrefix}${err}. Please check the server logs for more details.`;
};
export function getDS(uid) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!uid) {
            return undefined;
        }
        const dsSrv = getDataSourceSrv();
        try {
            return yield dsSrv.get(uid);
        }
        catch (error) {
            console.error('Failed to load data source', error);
            return undefined;
        }
    });
}
//# sourceMappingURL=utils.js.map