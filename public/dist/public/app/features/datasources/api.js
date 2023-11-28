import { __awaiter } from "tslib";
import { lastValueFrom } from 'rxjs';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { accessControlQueryParam } from 'app/core/utils/accessControl';
export const getDataSources = () => __awaiter(void 0, void 0, void 0, function* () {
    return yield getBackendSrv().get('/api/datasources');
});
/**
 * @deprecated Use `getDataSourceByUid` instead.
 */
export const getDataSourceById = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const response = yield lastValueFrom(getBackendSrv().fetch({
        method: 'GET',
        url: `/api/datasources/${id}`,
        params: accessControlQueryParam(),
        showErrorAlert: false,
    }));
    if (response.ok) {
        return response.data;
    }
    throw Error(`Could not find data source by ID: "${id}"`);
});
export const getDataSourceByUid = (uid) => __awaiter(void 0, void 0, void 0, function* () {
    const response = yield lastValueFrom(getBackendSrv().fetch({
        method: 'GET',
        url: `/api/datasources/uid/${uid}`,
        params: accessControlQueryParam(),
        showErrorAlert: false,
    }));
    if (response.ok) {
        return response.data;
    }
    throw Error(`Could not find data source by UID: "${uid}"`);
});
export const getDataSourceByIdOrUid = (idOrUid) => __awaiter(void 0, void 0, void 0, function* () {
    // Try with UID first, as we are trying to migrate to that
    try {
        return yield getDataSourceByUid(idOrUid);
    }
    catch (err) {
        console.log(`Failed to lookup data source using UID "${idOrUid}"`);
    }
    // Try using ID
    try {
        return yield getDataSourceById(idOrUid);
    }
    catch (err) {
        console.log(`Failed to lookup data source using ID "${idOrUid}"`);
    }
    throw Error('Could not find data source');
});
export const createDataSource = (dataSource) => getBackendSrv().post('/api/datasources', dataSource);
export const getDataSourcePlugins = () => getBackendSrv().get('/api/plugins', { enabled: 1, type: 'datasource' });
export const updateDataSource = (dataSource) => {
    // we're setting showErrorAlert and showSuccessAlert to false to suppress the popover notifications. Request result will now be
    // handled by the data source config page
    return getBackendSrv().put(`/api/datasources/uid/${dataSource.uid}`, dataSource, {
        showErrorAlert: false,
        showSuccessAlert: false,
    });
};
export const deleteDataSource = (uid) => getBackendSrv().delete(`/api/datasources/uid/${uid}`);
//# sourceMappingURL=api.js.map