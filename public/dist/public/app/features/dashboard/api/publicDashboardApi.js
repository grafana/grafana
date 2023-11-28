import { __awaiter, __rest } from "tslib";
import { createApi } from '@reduxjs/toolkit/query/react';
import { lastValueFrom } from 'rxjs';
import { getBackendSrv, isFetchError } from '@grafana/runtime/src';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification, createSuccessNotification } from 'app/core/copy/appNotification';
function isFetchBaseQueryError(error) {
    return typeof error === 'object' && error != null && 'error' in error;
}
const backendSrvBaseQuery = ({ baseUrl }) => (requestOptions) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const _a = yield lastValueFrom(getBackendSrv().fetch(Object.assign(Object.assign({}, requestOptions), { url: baseUrl + requestOptions.url, showErrorAlert: requestOptions.showErrorAlert }))), { data: responseData } = _a, meta = __rest(_a, ["data"]);
        return { data: responseData, meta };
    }
    catch (error) {
        return requestOptions.manageError ? requestOptions.manageError(error) : { error };
    }
});
const getConfigError = (err) => ({ error: isFetchError(err) && err.status !== 404 ? err : null });
export const publicDashboardApi = createApi({
    reducerPath: 'publicDashboardApi',
    baseQuery: backendSrvBaseQuery({ baseUrl: '/api' }),
    tagTypes: ['PublicDashboard', 'AuditTablePublicDashboard', 'UsersWithActiveSessions', 'ActiveUserDashboards'],
    refetchOnMountOrArgChange: true,
    endpoints: (builder) => ({
        getPublicDashboard: builder.query({
            query: (dashboardUid) => ({
                url: `/dashboards/uid/${dashboardUid}/public-dashboards`,
                manageError: getConfigError,
                showErrorAlert: false,
            }),
            onQueryStarted(_, { dispatch, queryFulfilled }) {
                return __awaiter(this, void 0, void 0, function* () {
                    try {
                        yield queryFulfilled;
                    }
                    catch (e) {
                        if (isFetchBaseQueryError(e) && isFetchError(e.error)) {
                            dispatch(notifyApp(createErrorNotification(e.error.data.message)));
                        }
                    }
                });
            },
            providesTags: (result, error, dashboardUid) => [{ type: 'PublicDashboard', id: dashboardUid }],
        }),
        createPublicDashboard: builder.mutation({
            query: (params) => ({
                url: `/dashboards/uid/${params.dashboard.uid}/public-dashboards`,
                method: 'POST',
                data: params.payload,
            }),
            onQueryStarted({ dashboard, payload }, { dispatch, queryFulfilled }) {
                return __awaiter(this, void 0, void 0, function* () {
                    const { data } = yield queryFulfilled;
                    dispatch(notifyApp(createSuccessNotification('Dashboard is public!')));
                    // Update runtime meta flag
                    dashboard.updateMeta({
                        publicDashboardUid: data.uid,
                        publicDashboardEnabled: data.isEnabled,
                    });
                });
            },
            invalidatesTags: (result, error, { dashboard }) => [{ type: 'PublicDashboard', id: dashboard.uid }],
        }),
        updatePublicDashboard: builder.mutation({
            query: (params) => ({
                url: `/dashboards/uid/${params.dashboard.uid}/public-dashboards/${params.payload.uid}`,
                method: 'PATCH',
                data: params.payload,
            }),
            onQueryStarted({ dashboard, payload }, { dispatch, queryFulfilled }) {
                return __awaiter(this, void 0, void 0, function* () {
                    const { data } = yield queryFulfilled;
                    dispatch(notifyApp(createSuccessNotification('Public dashboard updated!')));
                    if (dashboard.updateMeta) {
                        dashboard.updateMeta({
                            publicDashboardUid: data.uid,
                            publicDashboardEnabled: data.isEnabled,
                        });
                    }
                });
            },
            invalidatesTags: (result, error, { payload }) => [
                { type: 'PublicDashboard', id: payload.dashboardUid },
                'AuditTablePublicDashboard',
            ],
        }),
        addRecipient: builder.mutation({
            query: () => ({
                url: '',
            }),
        }),
        deleteRecipient: builder.mutation({
            query: () => ({
                url: '',
            }),
        }),
        reshareAccessToRecipient: builder.mutation({
            query: () => ({
                url: '',
            }),
        }),
        getActiveUsers: builder.query({
            query: () => ({
                url: '/',
            }),
            providesTags: ['UsersWithActiveSessions'],
        }),
        getActiveUserDashboards: builder.query({
            query: () => ({
                url: '',
            }),
            providesTags: (result, _, email) => [{ type: 'ActiveUserDashboards', id: email }],
        }),
        listPublicDashboards: builder.query({
            query: (page = 1) => ({
                url: `/dashboards/public-dashboards?page=${page}&perpage=8`,
            }),
            transformResponse: (response) => (Object.assign(Object.assign({}, response), { totalPages: Math.ceil(response.totalCount / response.perPage) })),
            providesTags: ['AuditTablePublicDashboard'],
        }),
        deletePublicDashboard: builder.mutation({
            query: (params) => ({
                url: `/dashboards/uid/${params.dashboardUid}/public-dashboards/${params.uid}`,
                method: 'DELETE',
            }),
            onQueryStarted({ dashboard, uid }, { dispatch, queryFulfilled }) {
                return __awaiter(this, void 0, void 0, function* () {
                    yield queryFulfilled;
                    dispatch(notifyApp(createSuccessNotification('Public dashboard deleted!')));
                    dashboard === null || dashboard === void 0 ? void 0 : dashboard.updateMeta({
                        publicDashboardUid: uid,
                        publicDashboardEnabled: false,
                    });
                });
            },
            invalidatesTags: (result, error, { dashboardUid }) => [
                { type: 'PublicDashboard', id: dashboardUid },
                'AuditTablePublicDashboard',
                'UsersWithActiveSessions',
                'ActiveUserDashboards',
            ],
        }),
    }),
});
export const { useGetPublicDashboardQuery, useCreatePublicDashboardMutation, useUpdatePublicDashboardMutation, useDeletePublicDashboardMutation, useListPublicDashboardsQuery, useAddRecipientMutation, useDeleteRecipientMutation, useReshareAccessToRecipientMutation, useGetActiveUsersQuery, useGetActiveUserDashboardsQuery, } = publicDashboardApi;
//# sourceMappingURL=publicDashboardApi.js.map