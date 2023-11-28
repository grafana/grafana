import { __awaiter } from "tslib";
import { locationUtil, DataSourceTestSucceeded, DataSourceTestFailed, } from '@grafana/data';
import { config, DataSourceWithBackend, HealthCheckError, isFetchError, locationService, } from '@grafana/runtime';
import { updateNavIndex } from 'app/core/actions';
import { appEvents, contextSrv } from 'app/core/core';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { ROUTES as CONNECTIONS_ROUTES } from 'app/features/connections/constants';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { getPluginSettings } from 'app/features/plugins/pluginSettings';
import { importDataSourcePlugin } from 'app/features/plugins/plugin_loader';
import * as api from '../api';
import { DATASOURCES_ROUTES } from '../constants';
import { trackDataSourceCreated, trackDataSourceTested } from '../tracking';
import { findNewName, nameExits } from '../utils';
import { buildCategories } from './buildCategories';
import { buildNavModel } from './navModel';
import { dataSourceLoaded, dataSourceMetaLoaded, dataSourcePluginsLoad, dataSourcePluginsLoaded, dataSourcesLoad, dataSourcesLoaded, initDataSourceSettingsFailed, initDataSourceSettingsSucceeded, testDataSourceFailed, testDataSourceStarting, testDataSourceSucceeded, } from './reducers';
import { getDataSource, getDataSourceMeta } from './selectors';
const parseHealthCheckError = (errorResponse) => {
    var _a;
    let message;
    let details;
    if (errorResponse.error && errorResponse.error instanceof HealthCheckError) {
        message = errorResponse.error.message;
        details = errorResponse.error.details;
    }
    else if (isFetchError(errorResponse)) {
        message = (_a = errorResponse.data.message) !== null && _a !== void 0 ? _a : `HTTP error ${errorResponse.statusText}`;
    }
    else if (errorResponse instanceof Error) {
        message = errorResponse.message;
    }
    return { message, details };
};
const parseHealthCheckSuccess = (response) => {
    const { details, message, status } = response;
    return { status, message, details };
};
export const initDataSourceSettings = (uid, dependencies = {
    loadDataSource,
    loadDataSourceMeta,
    getDataSource,
    getDataSourceMeta,
    importDataSourcePlugin,
}) => {
    return (dispatch, getState) => __awaiter(void 0, void 0, void 0, function* () {
        if (!uid) {
            dispatch(initDataSourceSettingsFailed(new Error('Invalid UID')));
            return;
        }
        try {
            const loadedDataSource = yield dispatch(dependencies.loadDataSource(uid));
            yield dispatch(dependencies.loadDataSourceMeta(loadedDataSource));
            const dataSource = dependencies.getDataSource(getState().dataSources, uid);
            const dataSourceMeta = dependencies.getDataSourceMeta(getState().dataSources, dataSource.type);
            const importedPlugin = yield dependencies.importDataSourcePlugin(dataSourceMeta);
            dispatch(initDataSourceSettingsSucceeded(importedPlugin));
        }
        catch (err) {
            if (err instanceof Error) {
                dispatch(initDataSourceSettingsFailed(err));
            }
        }
    });
};
export const testDataSource = (dataSourceName, editRoute = DATASOURCES_ROUTES.Edit, dependencies = {
    getDatasourceSrv,
    getBackendSrv,
}) => {
    return (dispatch, getState) => __awaiter(void 0, void 0, void 0, function* () {
        const dsApi = yield dependencies.getDatasourceSrv().get(dataSourceName);
        const editLink = editRoute.replace(/:uid/gi, dataSourceName);
        if (!dsApi.testDatasource) {
            return;
        }
        dispatch(testDataSourceStarting());
        dependencies.getBackendSrv().withNoBackendCache(() => __awaiter(void 0, void 0, void 0, function* () {
            try {
                const result = yield dsApi.testDatasource();
                const parsedResult = parseHealthCheckSuccess(Object.assign(Object.assign({}, result), { details: Object.assign({}, result.details) }));
                dispatch(testDataSourceSucceeded(parsedResult));
                trackDataSourceTested({
                    grafana_version: config.buildInfo.version,
                    plugin_id: dsApi.type,
                    datasource_uid: dsApi.uid,
                    success: true,
                    path: editLink,
                });
                appEvents.publish(new DataSourceTestSucceeded());
            }
            catch (err) {
                const formattedError = parseHealthCheckError(err);
                dispatch(testDataSourceFailed(Object.assign({}, formattedError)));
                trackDataSourceTested({
                    grafana_version: config.buildInfo.version,
                    plugin_id: dsApi.type,
                    datasource_uid: dsApi.uid,
                    success: false,
                    path: editLink,
                });
                appEvents.publish(new DataSourceTestFailed());
            }
        }));
    });
};
export function loadDataSources() {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        dispatch(dataSourcesLoad());
        const response = yield api.getDataSources();
        dispatch(dataSourcesLoaded(response));
    });
}
export function loadDataSource(uid) {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        let dataSource = yield api.getDataSourceByIdOrUid(uid);
        // Reload route to use UID instead
        // -------------------------------
        // In case we were trying to fetch and reference a data-source with an old numeric ID
        // (which can happen by referencing it with a "old" URL), we would like to automatically redirect
        // to the new URL format using the UID.
        // [Please revalidate the following]: Unfortunately we can update the location using react router, but need to fully reload the
        // route as the nav model page index is not matching with the url in that case.
        // And react router has no way to unmount remount a route.
        if (uid !== dataSource.uid) {
            window.location.href = locationUtil.assureBaseUrl(`/datasources/edit/${dataSource.uid}`);
            // Avoid a flashing error while the reload happens
            dataSource = {};
        }
        dispatch(dataSourceLoaded(dataSource));
        return dataSource;
    });
}
export function loadDataSourceMeta(dataSource) {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        const pluginInfo = yield getPluginSettings(dataSource.type);
        const plugin = yield importDataSourcePlugin(pluginInfo);
        const isBackend = plugin.DataSourceClass.prototype instanceof DataSourceWithBackend;
        const meta = Object.assign(Object.assign({}, pluginInfo), { isBackend: pluginInfo.backend || isBackend });
        dispatch(dataSourceMetaLoaded(meta));
        plugin.meta = meta;
        dispatch(updateNavIndex(buildNavModel(dataSource, plugin)));
    });
}
export function addDataSource(plugin, editRoute = DATASOURCES_ROUTES.Edit) {
    return (dispatch, getStore) => __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        // update the list of datasources first.
        // We later use this list to check whether the name of the datasource
        // being created is unuque or not and assign a new name to it if needed.
        const response = yield api.getDataSources();
        dispatch(dataSourcesLoaded(response));
        const dataSources = getStore().dataSources.dataSources;
        const isFirstDataSource = dataSources.length === 0;
        const newInstance = {
            name: plugin.name,
            type: plugin.id,
            access: 'proxy',
            isDefault: isFirstDataSource,
        };
        // TODO: typo in name
        if (nameExits(dataSources, newInstance.name)) {
            newInstance.name = findNewName(dataSources, newInstance.name);
        }
        const result = yield api.createDataSource(newInstance);
        const editLink = editRoute.replace(/:uid/gi, result.datasource.uid);
        yield getDatasourceSrv().reload();
        yield contextSrv.fetchUserPermissions();
        trackDataSourceCreated({
            grafana_version: config.buildInfo.version,
            plugin_id: plugin.id,
            datasource_uid: result.datasource.uid,
            plugin_version: (_b = (_a = result.meta) === null || _a === void 0 ? void 0 : _a.info) === null || _b === void 0 ? void 0 : _b.version,
            path: editLink,
        });
        locationService.push(editLink);
    });
}
export function loadDataSourcePlugins() {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        dispatch(dataSourcePluginsLoad());
        const plugins = yield api.getDataSourcePlugins();
        const categories = buildCategories(plugins);
        dispatch(dataSourcePluginsLoaded({ plugins, categories }));
    });
}
export function updateDataSource(dataSource) {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        try {
            yield api.updateDataSource(dataSource);
        }
        catch (err) {
            const formattedError = parseHealthCheckError(err);
            dispatch(testDataSourceFailed(formattedError));
            return Promise.reject(dataSource);
        }
        yield getDatasourceSrv().reload();
        return dispatch(loadDataSource(dataSource.uid));
    });
}
export function deleteLoadedDataSource() {
    return (dispatch, getStore) => __awaiter(this, void 0, void 0, function* () {
        const { uid } = getStore().dataSources.dataSource;
        try {
            yield api.deleteDataSource(uid);
            yield getDatasourceSrv().reload();
            const datasourcesUrl = CONNECTIONS_ROUTES.DataSources;
            locationService.push(datasourcesUrl);
        }
        catch (err) {
            const formattedError = parseHealthCheckError(err);
            dispatch(testDataSourceFailed(formattedError));
        }
    });
}
//# sourceMappingURL=actions.js.map