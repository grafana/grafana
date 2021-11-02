import { __assign, __awaiter, __generator, __values } from "tslib";
// Libraries
import coreModule from 'app/core/core_module';
// Services & Utils
import { importDataSourcePlugin } from './plugin_loader';
import { getDataSourceSrv as getDataSourceService, } from '@grafana/runtime';
// Types
import { AppEvents, } from '@grafana/data';
// Pretend Datasource
import { dataSource as expressionDatasource, ExpressionDatasourceID, ExpressionDatasourceUID, instanceSettings as expressionInstanceSettings, } from 'app/features/expressions/ExpressionDatasource';
import { cloneDeep } from 'lodash';
var DatasourceSrv = /** @class */ (function () {
    /** @ngInject */
    function DatasourceSrv($injector, $rootScope, templateSrv) {
        this.$injector = $injector;
        this.$rootScope = $rootScope;
        this.templateSrv = templateSrv;
        this.datasources = {}; // UID
        this.settingsMapByName = {};
        this.settingsMapByUid = {};
        this.settingsMapById = {};
        this.defaultName = ''; // actually UID
    }
    DatasourceSrv.prototype.init = function (settingsMapByName, defaultName) {
        var e_1, _a;
        this.datasources = {};
        this.settingsMapByUid = {};
        this.settingsMapByName = settingsMapByName;
        this.defaultName = defaultName;
        try {
            for (var _b = __values(Object.values(settingsMapByName)), _c = _b.next(); !_c.done; _c = _b.next()) {
                var dsSettings = _c.value;
                if (!dsSettings.uid) {
                    dsSettings.uid = dsSettings.name; // -- Grafana --, -- Mixed etc
                }
                this.settingsMapByUid[dsSettings.uid] = dsSettings;
                this.settingsMapById[dsSettings.id] = dsSettings;
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_1) throw e_1.error; }
        }
        // Preload expressions
        this.datasources[ExpressionDatasourceID] = expressionDatasource;
        this.datasources[ExpressionDatasourceUID] = expressionDatasource;
        this.settingsMapByUid[ExpressionDatasourceID] = expressionInstanceSettings;
        this.settingsMapByUid[ExpressionDatasourceUID] = expressionInstanceSettings;
    };
    DatasourceSrv.prototype.getDataSourceSettingsByUid = function (uid) {
        return this.settingsMapByUid[uid];
    };
    DatasourceSrv.prototype.getInstanceSettings = function (ref) {
        var _a, _b, _c, _d, _e;
        var isstring = typeof ref === 'string';
        var nameOrUid = isstring ? ref : (_a = ref) === null || _a === void 0 ? void 0 : _a.uid;
        if (nameOrUid === 'default' || nameOrUid === null || nameOrUid === undefined) {
            if (!isstring && ref) {
                var type = (_b = ref) === null || _b === void 0 ? void 0 : _b.type;
                if (type === ExpressionDatasourceID) {
                    return expressionDatasource.instanceSettings;
                }
                else if (type) {
                    console.log('FIND Default instance for datasource type?', ref);
                }
            }
            return (_c = this.settingsMapByUid[this.defaultName]) !== null && _c !== void 0 ? _c : this.settingsMapByName[this.defaultName];
        }
        // Complex logic to support template variable data source names
        // For this we just pick the current or first data source in the variable
        if (nameOrUid[0] === '$') {
            var interpolatedName = this.templateSrv.replace(nameOrUid, {}, variableInterpolation);
            var dsSettings = void 0;
            if (interpolatedName === 'default') {
                dsSettings = this.settingsMapByName[this.defaultName];
            }
            else {
                dsSettings = (_d = this.settingsMapByUid[interpolatedName]) !== null && _d !== void 0 ? _d : this.settingsMapByName[interpolatedName];
            }
            if (!dsSettings) {
                return undefined;
            }
            // The return name or uid needs preservet string containing the variable
            var clone = cloneDeep(dsSettings);
            clone.name = nameOrUid;
            // A data source being looked up using a variable should not be considered default
            clone.isDefault = false;
            return clone;
        }
        return (_e = this.settingsMapByUid[nameOrUid]) !== null && _e !== void 0 ? _e : this.settingsMapByName[nameOrUid];
    };
    DatasourceSrv.prototype.get = function (ref, scopedVars) {
        var _a;
        var nameOrUid = typeof ref === 'string' ? ref : (_a = ref) === null || _a === void 0 ? void 0 : _a.uid;
        if (!nameOrUid) {
            return this.get(this.defaultName);
        }
        // Check if nameOrUid matches a uid and then get the name
        var byName = this.settingsMapByName[nameOrUid];
        if (byName) {
            nameOrUid = byName.uid;
        }
        // This check is duplicated below, this is here mainly as performance optimization to skip interpolation
        if (this.datasources[nameOrUid]) {
            return Promise.resolve(this.datasources[nameOrUid]);
        }
        // Interpolation here is to support template variable in data source selection
        nameOrUid = this.templateSrv.replace(nameOrUid, scopedVars, variableInterpolation);
        if (nameOrUid === 'default' && this.defaultName !== 'default') {
            return this.get(this.defaultName);
        }
        if (this.datasources[nameOrUid]) {
            return Promise.resolve(this.datasources[nameOrUid]);
        }
        return this.loadDatasource(nameOrUid);
    };
    DatasourceSrv.prototype.loadDatasource = function (key) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function () {
            var dsConfig, dsPlugin, useAngular, instance, err_1;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        if (this.datasources[key]) {
                            return [2 /*return*/, Promise.resolve(this.datasources[key])];
                        }
                        dsConfig = (_b = (_a = this.settingsMapByUid[key]) !== null && _a !== void 0 ? _a : this.settingsMapByName[key]) !== null && _b !== void 0 ? _b : this.settingsMapById[key];
                        if (!dsConfig) {
                            return [2 /*return*/, Promise.reject({ message: "Datasource " + key + " was not found" })];
                        }
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, importDataSourcePlugin(dsConfig.meta)];
                    case 2:
                        dsPlugin = _c.sent();
                        // check if its in cache now
                        if (this.datasources[key]) {
                            return [2 /*return*/, this.datasources[key]];
                        }
                        useAngular = dsPlugin.DataSourceClass.length !== 1;
                        instance = useAngular
                            ? this.$injector.instantiate(dsPlugin.DataSourceClass, {
                                instanceSettings: dsConfig,
                            })
                            : new dsPlugin.DataSourceClass(dsConfig);
                        instance.components = dsPlugin.components;
                        instance.meta = dsConfig.meta;
                        // store in instance cache
                        this.datasources[key] = instance;
                        this.datasources[instance.uid] = instance;
                        return [2 /*return*/, instance];
                    case 3:
                        err_1 = _c.sent();
                        if (this.$rootScope) {
                            this.$rootScope.appEvent(AppEvents.alertError, [dsConfig.name + ' plugin failed', err_1.toString()]);
                        }
                        return [2 /*return*/, Promise.reject({ message: "Datasource: " + key + " was not found" })];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    DatasourceSrv.prototype.getAll = function () {
        return Object.values(this.settingsMapByName);
    };
    DatasourceSrv.prototype.getList = function (filters) {
        var e_2, _a;
        if (filters === void 0) { filters = {}; }
        var base = Object.values(this.settingsMapByName).filter(function (x) {
            if (x.meta.id === 'grafana' || x.meta.id === 'mixed' || x.meta.id === 'dashboard') {
                return false;
            }
            if (filters.metrics && !x.meta.metrics) {
                return false;
            }
            if (filters.alerting && !x.meta.alerting) {
                return false;
            }
            if (filters.tracing && !x.meta.tracing) {
                return false;
            }
            if (filters.annotations && !x.meta.annotations) {
                return false;
            }
            if (filters.alerting && !x.meta.alerting) {
                return false;
            }
            if (filters.pluginId && x.meta.id !== filters.pluginId) {
                return false;
            }
            if (filters.filter && !filters.filter(x)) {
                return false;
            }
            if (filters.type && (Array.isArray(filters.type) ? !filters.type.includes(x.type) : filters.type !== x.type)) {
                return false;
            }
            if (!filters.all &&
                x.meta.metrics !== true &&
                x.meta.annotations !== true &&
                x.meta.tracing !== true &&
                x.meta.logs !== true &&
                x.meta.alerting !== true) {
                return false;
            }
            return true;
        });
        if (filters.variables) {
            try {
                for (var _b = __values(this.templateSrv.getVariables().filter(function (variable) { return variable.type === 'datasource'; })), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var variable = _c.value;
                    var dsVar = variable;
                    var first = dsVar.current.value === 'default' ? this.defaultName : dsVar.current.value;
                    var dsName = first;
                    var dsSettings = this.settingsMapByName[dsName];
                    if (dsSettings) {
                        var key = "${" + variable.name + "}";
                        base.push(__assign(__assign({}, dsSettings), { name: key }));
                    }
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                }
                finally { if (e_2) throw e_2.error; }
            }
        }
        var sorted = base.sort(function (a, b) {
            if (a.name.toLowerCase() > b.name.toLowerCase()) {
                return 1;
            }
            if (a.name.toLowerCase() < b.name.toLowerCase()) {
                return -1;
            }
            return 0;
        });
        if (!filters.pluginId && !filters.alerting) {
            if (filters.mixed) {
                base.push(this.getInstanceSettings('-- Mixed --'));
            }
            if (filters.dashboard) {
                base.push(this.getInstanceSettings('-- Dashboard --'));
            }
            if (!filters.tracing) {
                base.push(this.getInstanceSettings('-- Grafana --'));
            }
        }
        return sorted;
    };
    /**
     * @deprecated use getList
     * */
    DatasourceSrv.prototype.getExternal = function () {
        return this.getList();
    };
    /**
     * @deprecated use getList
     * */
    DatasourceSrv.prototype.getAnnotationSources = function () {
        return this.getList({ annotations: true, variables: true }).map(function (x) {
            return {
                name: x.name,
                value: x.isDefault ? null : x.name,
                meta: x.meta,
            };
        });
    };
    /**
     * @deprecated use getList
     * */
    DatasourceSrv.prototype.getMetricSources = function (options) {
        return this.getList({ metrics: true, variables: !(options === null || options === void 0 ? void 0 : options.skipVariables) }).map(function (x) {
            return {
                name: x.name,
                value: x.isDefault ? null : x.name,
                meta: x.meta,
            };
        });
    };
    return DatasourceSrv;
}());
export { DatasourceSrv };
export function variableInterpolation(value) {
    if (Array.isArray(value)) {
        return value[0];
    }
    return value;
}
export var getDatasourceSrv = function () {
    return getDataSourceService();
};
coreModule.service('datasourceSrv', DatasourceSrv);
export default DatasourceSrv;
//# sourceMappingURL=datasource_srv.js.map