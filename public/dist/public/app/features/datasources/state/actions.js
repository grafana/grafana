import { __assign, __awaiter, __generator } from "tslib";
import { lastValueFrom } from 'rxjs';
import { locationUtil } from '@grafana/data';
import { DataSourceWithBackend, locationService } from '@grafana/runtime';
import { updateNavIndex } from 'app/core/actions';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { importDataSourcePlugin } from 'app/features/plugins/plugin_loader';
import { getPluginSettings } from 'app/features/plugins/PluginSettingsCache';
import config from '../../../core/config';
import { buildCategories } from './buildCategories';
import { buildNavModel } from './navModel';
import { dataSourceLoaded, dataSourceMetaLoaded, dataSourcePluginsLoad, dataSourcePluginsLoaded, dataSourcesLoaded, initDataSourceSettingsFailed, initDataSourceSettingsSucceeded, testDataSourceFailed, testDataSourceStarting, testDataSourceSucceeded, } from './reducers';
import { getDataSource, getDataSourceMeta } from './selectors';
export var initDataSourceSettings = function (pageId, dependencies) {
    if (dependencies === void 0) { dependencies = {
        loadDataSource: loadDataSource,
        loadDataSourceMeta: loadDataSourceMeta,
        getDataSource: getDataSource,
        getDataSourceMeta: getDataSourceMeta,
        importDataSourcePlugin: importDataSourcePlugin,
    }; }
    return function (dispatch, getState) { return __awaiter(void 0, void 0, void 0, function () {
        var loadedDataSource, dataSource, dataSourceMeta, importedPlugin, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!pageId) {
                        dispatch(initDataSourceSettingsFailed(new Error('Invalid ID')));
                        return [2 /*return*/];
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 5, , 6]);
                    return [4 /*yield*/, dispatch(dependencies.loadDataSource(pageId))];
                case 2:
                    loadedDataSource = _a.sent();
                    return [4 /*yield*/, dispatch(dependencies.loadDataSourceMeta(loadedDataSource))];
                case 3:
                    _a.sent();
                    // have we already loaded the plugin then we can skip the steps below?
                    if (getState().dataSourceSettings.plugin) {
                        return [2 /*return*/];
                    }
                    dataSource = dependencies.getDataSource(getState().dataSources, pageId);
                    dataSourceMeta = dependencies.getDataSourceMeta(getState().dataSources, dataSource.type);
                    return [4 /*yield*/, dependencies.importDataSourcePlugin(dataSourceMeta)];
                case 4:
                    importedPlugin = _a.sent();
                    dispatch(initDataSourceSettingsSucceeded(importedPlugin));
                    return [3 /*break*/, 6];
                case 5:
                    err_1 = _a.sent();
                    dispatch(initDataSourceSettingsFailed(err_1));
                    return [3 /*break*/, 6];
                case 6: return [2 /*return*/];
            }
        });
    }); };
};
export var testDataSource = function (dataSourceName, dependencies) {
    if (dependencies === void 0) { dependencies = {
        getDatasourceSrv: getDatasourceSrv,
        getBackendSrv: getBackendSrv,
    }; }
    return function (dispatch, getState) { return __awaiter(void 0, void 0, void 0, function () {
        var dsApi;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, dependencies.getDatasourceSrv().get(dataSourceName)];
                case 1:
                    dsApi = _a.sent();
                    if (!dsApi.testDatasource) {
                        return [2 /*return*/];
                    }
                    dispatch(testDataSourceStarting());
                    dependencies.getBackendSrv().withNoBackendCache(function () { return __awaiter(void 0, void 0, void 0, function () {
                        var result, err_2, statusText, errMessage, details, data, message;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    return [4 /*yield*/, dsApi.testDatasource()];
                                case 1:
                                    result = _a.sent();
                                    dispatch(testDataSourceSucceeded(result));
                                    return [3 /*break*/, 3];
                                case 2:
                                    err_2 = _a.sent();
                                    statusText = err_2.statusText, errMessage = err_2.message, details = err_2.details, data = err_2.data;
                                    message = errMessage || (data === null || data === void 0 ? void 0 : data.message) || 'HTTP error ' + statusText;
                                    dispatch(testDataSourceFailed({ message: message, details: details }));
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    return [2 /*return*/];
            }
        });
    }); };
};
export function loadDataSources() {
    var _this = this;
    return function (dispatch) { return __awaiter(_this, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getBackendSrv().get('/api/datasources')];
                case 1:
                    response = _a.sent();
                    dispatch(dataSourcesLoaded(response));
                    return [2 /*return*/];
            }
        });
    }); };
}
export function loadDataSource(uid) {
    var _this = this;
    return function (dispatch) { return __awaiter(_this, void 0, void 0, function () {
        var dataSource;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getDataSourceUsingUidOrId(uid)];
                case 1:
                    dataSource = _a.sent();
                    dispatch(dataSourceLoaded(dataSource));
                    return [2 /*return*/, dataSource];
            }
        });
    }); };
}
export function loadDataSourceMeta(dataSource) {
    var _this = this;
    return function (dispatch) { return __awaiter(_this, void 0, void 0, function () {
        var pluginInfo, plugin, isBackend, meta;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getPluginSettings(dataSource.type)];
                case 1:
                    pluginInfo = (_a.sent());
                    return [4 /*yield*/, importDataSourcePlugin(pluginInfo)];
                case 2:
                    plugin = _a.sent();
                    isBackend = plugin.DataSourceClass.prototype instanceof DataSourceWithBackend;
                    meta = __assign(__assign({}, pluginInfo), { isBackend: isBackend });
                    dispatch(dataSourceMetaLoaded(meta));
                    plugin.meta = meta;
                    dispatch(updateNavIndex(buildNavModel(dataSource, plugin)));
                    return [2 /*return*/];
            }
        });
    }); };
}
/**
 * Get data source by uid or id, if old id detected handles redirect
 */
export function getDataSourceUsingUidOrId(uid) {
    return __awaiter(this, void 0, void 0, function () {
        var byUid, err_3, id, response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, lastValueFrom(getBackendSrv().fetch({
                            method: 'GET',
                            url: "/api/datasources/uid/" + uid,
                            showErrorAlert: false,
                        }))];
                case 1:
                    byUid = _a.sent();
                    if (byUid.ok) {
                        return [2 /*return*/, byUid.data];
                    }
                    return [3 /*break*/, 3];
                case 2:
                    err_3 = _a.sent();
                    console.log('Failed to lookup data source by uid', err_3);
                    return [3 /*break*/, 3];
                case 3:
                    id = typeof uid === 'string' ? parseInt(uid, 10) : uid;
                    if (!!Number.isNaN(id)) return [3 /*break*/, 5];
                    return [4 /*yield*/, lastValueFrom(getBackendSrv().fetch({
                            method: 'GET',
                            url: "/api/datasources/" + id,
                            showErrorAlert: false,
                        }))];
                case 4:
                    response = _a.sent();
                    // If the uid is a number, then this is a refresh on one of the settings tabs
                    // and we can return the response data
                    if (response.ok && typeof uid === 'number' && response.data.id === uid) {
                        return [2 /*return*/, response.data];
                    }
                    // Not ideal to do a full page reload here but so tricky to handle this
                    // otherwise We can update the location using react router, but need to
                    // fully reload the route as the nav model page index is not matching with
                    // the url in that case. And react router has no way to unmount remount a
                    // route
                    if (response.ok && response.data.id.toString() === uid) {
                        window.location.href = locationUtil.assureBaseUrl("/datasources/edit/" + response.data.uid);
                        return [2 /*return*/, {}]; // avoids flashing an error
                    }
                    _a.label = 5;
                case 5: throw Error('Could not find data source');
            }
        });
    });
}
export function addDataSource(plugin) {
    var _this = this;
    return function (dispatch, getStore) { return __awaiter(_this, void 0, void 0, function () {
        var dataSources, newInstance, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, dispatch(loadDataSources())];
                case 1:
                    _a.sent();
                    dataSources = getStore().dataSources.dataSources;
                    newInstance = {
                        name: plugin.name,
                        type: plugin.id,
                        access: 'proxy',
                        isDefault: dataSources.length === 0,
                    };
                    if (nameExits(dataSources, newInstance.name)) {
                        newInstance.name = findNewName(dataSources, newInstance.name);
                    }
                    return [4 /*yield*/, getBackendSrv().post('/api/datasources', newInstance)];
                case 2:
                    result = _a.sent();
                    return [4 /*yield*/, updateFrontendSettings()];
                case 3:
                    _a.sent();
                    locationService.push("/datasources/edit/" + result.datasource.uid);
                    return [2 /*return*/];
            }
        });
    }); };
}
export function loadDataSourcePlugins() {
    var _this = this;
    return function (dispatch) { return __awaiter(_this, void 0, void 0, function () {
        var plugins, categories;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    dispatch(dataSourcePluginsLoad());
                    return [4 /*yield*/, getBackendSrv().get('/api/plugins', { enabled: 1, type: 'datasource' })];
                case 1:
                    plugins = _a.sent();
                    categories = buildCategories(plugins);
                    dispatch(dataSourcePluginsLoaded({ plugins: plugins, categories: categories }));
                    return [2 /*return*/];
            }
        });
    }); };
}
export function updateDataSource(dataSource) {
    var _this = this;
    return function (dispatch) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getBackendSrv().put("/api/datasources/" + dataSource.id, dataSource)];
                case 1:
                    _a.sent(); // by UID not yet supported
                    return [4 /*yield*/, updateFrontendSettings()];
                case 2:
                    _a.sent();
                    return [2 /*return*/, dispatch(loadDataSource(dataSource.uid))];
            }
        });
    }); };
}
export function deleteDataSource() {
    var _this = this;
    return function (dispatch, getStore) { return __awaiter(_this, void 0, void 0, function () {
        var dataSource;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    dataSource = getStore().dataSources.dataSource;
                    return [4 /*yield*/, getBackendSrv().delete("/api/datasources/" + dataSource.id)];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, updateFrontendSettings()];
                case 2:
                    _a.sent();
                    locationService.push('/datasources');
                    return [2 /*return*/];
            }
        });
    }); };
}
export function nameExits(dataSources, name) {
    return (dataSources.filter(function (dataSource) {
        return dataSource.name.toLowerCase() === name.toLowerCase();
    }).length > 0);
}
export function findNewName(dataSources, name) {
    // Need to loop through current data sources to make sure
    // the name doesn't exist
    while (nameExits(dataSources, name)) {
        // If there's a duplicate name that doesn't end with '-x'
        // we can add -1 to the name and be done.
        if (!nameHasSuffix(name)) {
            name = name + "-1";
        }
        else {
            // if there's a duplicate name that ends with '-x'
            // we can try to increment the last digit until the name is unique
            // remove the 'x' part and replace it with the new number
            name = "" + getNewName(name) + incrementLastDigit(getLastDigit(name));
        }
    }
    return name;
}
function updateFrontendSettings() {
    return getBackendSrv()
        .get('/api/frontend/settings')
        .then(function (settings) {
        config.datasources = settings.datasources;
        config.defaultDatasource = settings.defaultDatasource;
        getDatasourceSrv().init(config.datasources, settings.defaultDatasource);
    });
}
function nameHasSuffix(name) {
    return name.endsWith('-', name.length - 1);
}
function getLastDigit(name) {
    return parseInt(name.slice(-1), 10);
}
function incrementLastDigit(digit) {
    return isNaN(digit) ? 1 : digit + 1;
}
function getNewName(name) {
    return name.slice(0, name.length - 1);
}
//# sourceMappingURL=actions.js.map