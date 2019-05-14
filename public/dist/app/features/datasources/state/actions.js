import * as tslib_1 from "tslib";
import config from '../../../core/config';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { updateLocation, updateNavIndex } from 'app/core/actions';
import { buildNavModel } from './navModel';
import { actionCreatorFactory } from 'app/core/redux';
import { noPayloadActionCreatorFactory } from 'app/core/redux/actionCreatorFactory';
export var dataSourceLoaded = actionCreatorFactory('LOAD_DATA_SOURCE').create();
export var dataSourcesLoaded = actionCreatorFactory('LOAD_DATA_SOURCES').create();
export var dataSourceMetaLoaded = actionCreatorFactory('LOAD_DATA_SOURCE_META').create();
export var dataSourceTypesLoad = noPayloadActionCreatorFactory('LOAD_DATA_SOURCE_TYPES').create();
export var dataSourceTypesLoaded = actionCreatorFactory('LOADED_DATA_SOURCE_TYPES').create();
export var setDataSourcesSearchQuery = actionCreatorFactory('SET_DATA_SOURCES_SEARCH_QUERY').create();
export var setDataSourcesLayoutMode = actionCreatorFactory('SET_DATA_SOURCES_LAYOUT_MODE').create();
export var setDataSourceTypeSearchQuery = actionCreatorFactory('SET_DATA_SOURCE_TYPE_SEARCH_QUERY').create();
export var setDataSourceName = actionCreatorFactory('SET_DATA_SOURCE_NAME').create();
export var setIsDefault = actionCreatorFactory('SET_IS_DEFAULT').create();
export function loadDataSources() {
    var _this = this;
    return function (dispatch) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        var response;
        return tslib_1.__generator(this, function (_a) {
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
export function loadDataSource(id) {
    var _this = this;
    return function (dispatch) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        var dataSource, pluginInfo;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getBackendSrv().get("/api/datasources/" + id)];
                case 1:
                    dataSource = _a.sent();
                    return [4 /*yield*/, getBackendSrv().get("/api/plugins/" + dataSource.type + "/settings")];
                case 2:
                    pluginInfo = _a.sent();
                    dispatch(dataSourceLoaded(dataSource));
                    dispatch(dataSourceMetaLoaded(pluginInfo));
                    dispatch(updateNavIndex(buildNavModel(dataSource, pluginInfo)));
                    return [2 /*return*/];
            }
        });
    }); };
}
export function addDataSource(plugin) {
    var _this = this;
    return function (dispatch, getStore) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        var dataSources, newInstance, result;
        return tslib_1.__generator(this, function (_a) {
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
                    dispatch(updateLocation({ path: "/datasources/edit/" + result.id }));
                    return [2 /*return*/];
            }
        });
    }); };
}
export function loadDataSourceTypes() {
    var _this = this;
    return function (dispatch) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        var result;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    dispatch(dataSourceTypesLoad());
                    return [4 /*yield*/, getBackendSrv().get('/api/plugins', { enabled: 1, type: 'datasource' })];
                case 1:
                    result = _a.sent();
                    dispatch(dataSourceTypesLoaded(result));
                    return [2 /*return*/];
            }
        });
    }); };
}
export function updateDataSource(dataSource) {
    var _this = this;
    return function (dispatch) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getBackendSrv().put("/api/datasources/" + dataSource.id, dataSource)];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, updateFrontendSettings()];
                case 2:
                    _a.sent();
                    return [2 /*return*/, dispatch(loadDataSource(dataSource.id))];
            }
        });
    }); };
}
export function deleteDataSource() {
    var _this = this;
    return function (dispatch, getStore) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        var dataSource;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    dataSource = getStore().dataSources.dataSource;
                    return [4 /*yield*/, getBackendSrv().delete("/api/datasources/" + dataSource.id)];
                case 1:
                    _a.sent();
                    dispatch(updateLocation({ path: '/datasources' }));
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
        getDatasourceSrv().init();
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