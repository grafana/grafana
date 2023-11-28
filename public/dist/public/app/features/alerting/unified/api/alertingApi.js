import { __awaiter, __rest } from "tslib";
import { createApi } from '@reduxjs/toolkit/query/react';
import { lastValueFrom } from 'rxjs';
import { getBackendSrv } from '@grafana/runtime';
import { logInfo } from '../Analytics';
export const backendSrvBaseQuery = () => (requestOptions) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const requestStartTs = performance.now();
        const _b = yield lastValueFrom(getBackendSrv().fetch(requestOptions)), { data } = _b, meta = __rest(_b, ["data"]);
        logInfo('Request finished', {
            loadTimeMs: (performance.now() - requestStartTs).toFixed(0),
            url: requestOptions.url,
            method: (_a = requestOptions.method) !== null && _a !== void 0 ? _a : '',
            responseStatus: meta.statusText,
        });
        return { data, meta };
    }
    catch (error) {
        return { error };
    }
});
export const alertingApi = createApi({
    reducerPath: 'alertingApi',
    baseQuery: backendSrvBaseQuery(),
    tagTypes: ['AlertmanagerChoice', 'AlertmanagerConfiguration', 'OnCallIntegrations'],
    endpoints: () => ({}),
});
//# sourceMappingURL=alertingApi.js.map