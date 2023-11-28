import { __awaiter, __rest } from "tslib";
import { createApi } from '@reduxjs/toolkit/query/react';
import { lastValueFrom } from 'rxjs';
import { isTruthy, locationUtil } from '@grafana/data';
import { getBackendSrv, locationService } from '@grafana/runtime';
import { notifyApp } from 'app/core/actions';
import { createSuccessNotification } from 'app/core/copy/appNotification';
import { contextSrv } from 'app/core/core';
import { dashboardWatcher } from 'app/features/live/dashboard/dashboardWatcher';
import { refetchChildren, refreshParents } from '../state';
import { PAGE_SIZE } from './services';
function createBackendSrvBaseQuery({ baseURL }) {
    function backendSrvBaseQuery(requestOptions) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const _a = yield lastValueFrom(getBackendSrv().fetch(Object.assign(Object.assign({}, requestOptions), { url: baseURL + requestOptions.url, showErrorAlert: requestOptions.showErrorAlert }))), { data: responseData } = _a, meta = __rest(_a, ["data"]);
                return { data: responseData, meta };
            }
            catch (error) {
                return requestOptions.manageError ? requestOptions.manageError(error) : { error };
            }
        });
    }
    return backendSrvBaseQuery;
}
export const browseDashboardsAPI = createApi({
    tagTypes: ['getFolder'],
    reducerPath: 'browseDashboardsAPI',
    baseQuery: createBackendSrvBaseQuery({ baseURL: '/api' }),
    endpoints: (builder) => ({
        // get folder info (e.g. title, parents) but *not* children
        getFolder: builder.query({
            providesTags: (_result, _error, folderUID) => [{ type: 'getFolder', id: folderUID }],
            query: (folderUID) => ({ url: `/folders/${folderUID}`, params: { accesscontrol: true } }),
        }),
        // create a new folder
        newFolder: builder.mutation({
            query: ({ title, parentUid }) => ({
                method: 'POST',
                url: '/folders',
                data: {
                    title,
                    parentUid,
                },
            }),
            onQueryStarted: ({ parentUid }, { queryFulfilled, dispatch }) => {
                queryFulfilled.then(({ data: folder }) => __awaiter(void 0, void 0, void 0, function* () {
                    yield contextSrv.fetchUserPermissions();
                    dispatch(notifyApp(createSuccessNotification('Folder created')));
                    dispatch(refetchChildren({
                        parentUID: parentUid,
                        pageSize: PAGE_SIZE,
                    }));
                    locationService.push(locationUtil.stripBaseFromUrl(folder.url));
                }));
            },
        }),
        // save an existing folder (e.g. rename)
        saveFolder: builder.mutation({
            // because the getFolder calls contain the parents, renaming a parent/grandparent/etc needs to invalidate all child folders
            // we could do something smart and recursively invalidate these child folders but it doesn't seem worth it
            // instead let's just invalidate all the getFolder calls
            invalidatesTags: ['getFolder'],
            query: ({ uid, title, version }) => ({
                method: 'PUT',
                url: `/folders/${uid}`,
                data: {
                    title,
                    version,
                },
            }),
            onQueryStarted: ({ parentUid }, { queryFulfilled, dispatch }) => {
                queryFulfilled.then(() => {
                    dispatch(refetchChildren({
                        parentUID: parentUid,
                        pageSize: PAGE_SIZE,
                    }));
                });
            },
        }),
        // move an *individual* folder. used in the folder actions menu.
        moveFolder: builder.mutation({
            invalidatesTags: ['getFolder'],
            query: ({ folder, destinationUID }) => ({
                url: `/folders/${folder.uid}/move`,
                method: 'POST',
                data: { parentUID: destinationUID },
            }),
            onQueryStarted: ({ folder, destinationUID }, { queryFulfilled, dispatch }) => {
                const { parentUid } = folder;
                queryFulfilled.then(() => {
                    dispatch(refetchChildren({
                        parentUID: parentUid,
                        pageSize: PAGE_SIZE,
                    }));
                    dispatch(refetchChildren({
                        parentUID: destinationUID,
                        pageSize: PAGE_SIZE,
                    }));
                });
            },
        }),
        // delete an *individual* folder. used in the folder actions menu.
        deleteFolder: builder.mutation({
            query: ({ uid }) => ({
                url: `/folders/${uid}`,
                method: 'DELETE',
                params: {
                    // TODO: Once backend returns alert rule counts, set this back to true
                    // when this is merged https://github.com/grafana/grafana/pull/67259
                    forceDeleteRules: false,
                },
            }),
            onQueryStarted: ({ parentUid }, { queryFulfilled, dispatch }) => {
                queryFulfilled.then(() => {
                    dispatch(refetchChildren({
                        parentUID: parentUid,
                        pageSize: PAGE_SIZE,
                    }));
                });
            },
        }),
        // gets the descendant counts for a folder. used in the move/delete modals.
        getAffectedItems: builder.query({
            queryFn: (selectedItems) => __awaiter(void 0, void 0, void 0, function* () {
                var _a;
                const folderUIDs = Object.keys(selectedItems.folder).filter((uid) => selectedItems.folder[uid]);
                const promises = folderUIDs.map((folderUID) => {
                    return getBackendSrv().get(`/api/folders/${folderUID}/counts`);
                });
                const results = yield Promise.all(promises);
                const totalCounts = {
                    folder: Object.values(selectedItems.folder).filter(isTruthy).length,
                    dashboard: Object.values(selectedItems.dashboard).filter(isTruthy).length,
                    libraryPanel: 0,
                    alertRule: 0,
                };
                for (const folderCounts of results) {
                    // TODO remove nullish coalescing once nestedFolders is toggled on
                    totalCounts.folder += (_a = folderCounts.folder) !== null && _a !== void 0 ? _a : 0;
                    totalCounts.dashboard += folderCounts.dashboard;
                    totalCounts.alertRule += folderCounts.alertrule;
                    totalCounts.libraryPanel += folderCounts.librarypanel;
                }
                return { data: totalCounts };
            }),
        }),
        // move *multiple* items (folders and dashboards). used in the move modal.
        moveItems: builder.mutation({
            invalidatesTags: ['getFolder'],
            queryFn: ({ selectedItems, destinationUID }, _api, _extraOptions, baseQuery) => __awaiter(void 0, void 0, void 0, function* () {
                const selectedDashboards = Object.keys(selectedItems.dashboard).filter((uid) => selectedItems.dashboard[uid]);
                const selectedFolders = Object.keys(selectedItems.folder).filter((uid) => selectedItems.folder[uid]);
                // Move all the folders sequentially
                // TODO error handling here
                for (const folderUID of selectedFolders) {
                    yield baseQuery({
                        url: `/folders/${folderUID}/move`,
                        method: 'POST',
                        data: { parentUID: destinationUID },
                    });
                }
                // Move all the dashboards sequentially
                // TODO error handling here
                for (const dashboardUID of selectedDashboards) {
                    const fullDash = yield getBackendSrv().get(`/api/dashboards/uid/${dashboardUID}`);
                    const options = {
                        dashboard: fullDash.dashboard,
                        folderUid: destinationUID,
                        overwrite: false,
                        message: '',
                    };
                    yield baseQuery({
                        url: `/dashboards/db`,
                        method: 'POST',
                        data: options,
                    });
                }
                return { data: undefined };
            }),
            onQueryStarted: ({ destinationUID, selectedItems }, { queryFulfilled, dispatch }) => {
                const selectedDashboards = Object.keys(selectedItems.dashboard).filter((uid) => selectedItems.dashboard[uid]);
                const selectedFolders = Object.keys(selectedItems.folder).filter((uid) => selectedItems.folder[uid]);
                queryFulfilled.then(() => {
                    dispatch(refetchChildren({
                        parentUID: destinationUID,
                        pageSize: PAGE_SIZE,
                    }));
                    dispatch(refreshParents([...selectedFolders, ...selectedDashboards]));
                });
            },
        }),
        // delete *multiple* items (folders and dashboards). used in the delete modal.
        deleteItems: builder.mutation({
            queryFn: ({ selectedItems }, _api, _extraOptions, baseQuery) => __awaiter(void 0, void 0, void 0, function* () {
                const selectedDashboards = Object.keys(selectedItems.dashboard).filter((uid) => selectedItems.dashboard[uid]);
                const selectedFolders = Object.keys(selectedItems.folder).filter((uid) => selectedItems.folder[uid]);
                // Delete all the folders sequentially
                // TODO error handling here
                for (const folderUID of selectedFolders) {
                    yield baseQuery({
                        url: `/folders/${folderUID}`,
                        method: 'DELETE',
                        params: {
                            // TODO: Once backend returns alert rule counts, set this back to true
                            // when this is merged https://github.com/grafana/grafana/pull/67259
                            forceDeleteRules: false,
                        },
                    });
                }
                // Delete all the dashboards sequentially
                // TODO error handling here
                for (const dashboardUID of selectedDashboards) {
                    yield baseQuery({
                        url: `/dashboards/uid/${dashboardUID}`,
                        method: 'DELETE',
                    });
                }
                return { data: undefined };
            }),
            onQueryStarted: ({ selectedItems }, { queryFulfilled, dispatch }) => {
                const selectedDashboards = Object.keys(selectedItems.dashboard).filter((uid) => selectedItems.dashboard[uid]);
                const selectedFolders = Object.keys(selectedItems.folder).filter((uid) => selectedItems.folder[uid]);
                queryFulfilled.then(() => {
                    dispatch(refreshParents([...selectedFolders, ...selectedDashboards]));
                });
            },
        }),
        // save an existing dashboard
        saveDashboard: builder.mutation({
            query: ({ dashboard, folderUid, message, overwrite }) => ({
                url: `/dashboards/db`,
                method: 'POST',
                data: {
                    dashboard,
                    folderUid,
                    message: message !== null && message !== void 0 ? message : '',
                    overwrite: Boolean(overwrite),
                },
            }),
            onQueryStarted: ({ folderUid }, { queryFulfilled, dispatch }) => {
                dashboardWatcher.ignoreNextSave();
                queryFulfilled.then(() => __awaiter(void 0, void 0, void 0, function* () {
                    yield contextSrv.fetchUserPermissions();
                    dispatch(refetchChildren({
                        parentUID: folderUid,
                        pageSize: PAGE_SIZE,
                    }));
                }));
            },
        }),
    }),
});
export const { endpoints, useDeleteFolderMutation, useDeleteItemsMutation, useGetAffectedItemsQuery, useGetFolderQuery, useMoveFolderMutation, useMoveItemsMutation, useNewFolderMutation, useSaveDashboardMutation, useSaveFolderMutation, } = browseDashboardsAPI;
export { skipToken } from '@reduxjs/toolkit/query/react';
//# sourceMappingURL=browseDashboardsAPI.js.map