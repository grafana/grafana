import { __awaiter } from "tslib";
import { createApi } from '@reduxjs/toolkit/query/react';
import { lastValueFrom } from 'rxjs';
import { getBackendSrv } from '@grafana/runtime';
const backendSrvBaseQuery = ({ baseUrl }) => ({ url, method = 'GET', body }) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { data } = yield lastValueFrom(getBackendSrv().fetch({
            url: baseUrl + url,
            method,
            data: body,
        }));
        return { data };
    }
    catch (error) {
        return { error };
    }
});
export const togglesApi = createApi({
    reducerPath: 'togglesApi',
    baseQuery: backendSrvBaseQuery({ baseUrl: '/api' }),
    endpoints: (builder) => ({
        getManagerState: builder.query({
            query: () => ({ url: '/featuremgmt/state' }),
        }),
        getFeatureToggles: builder.query({
            query: () => ({ url: '/featuremgmt' }),
        }),
        updateFeatureToggles: builder.mutation({
            query: (updatedToggles) => ({
                url: '/featuremgmt',
                method: 'POST',
                body: { featureToggles: updatedToggles },
            }),
        }),
    }),
});
export const { useGetManagerStateQuery, useGetFeatureTogglesQuery, useUpdateFeatureTogglesMutation } = togglesApi;
//# sourceMappingURL=AdminFeatureTogglesAPI.js.map