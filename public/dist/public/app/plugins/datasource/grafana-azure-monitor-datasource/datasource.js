import { __awaiter, __extends, __generator, __read, __values } from "tslib";
import { cloneDeep, upperFirst } from 'lodash';
import AzureMonitorDatasource from './azure_monitor/azure_monitor_datasource';
import AppInsightsDatasource from './app_insights/app_insights_datasource';
import AzureLogAnalyticsDatasource from './azure_log_analytics/azure_log_analytics_datasource';
import ResourcePickerData from './resourcePicker/resourcePickerData';
import { AzureQueryType } from './types';
import { DataSourceApi, LoadingState, } from '@grafana/data';
import { forkJoin, of } from 'rxjs';
import { getTemplateSrv } from '@grafana/runtime';
import InsightsAnalyticsDatasource from './insights_analytics/insights_analytics_datasource';
import { datasourceMigrations } from './utils/migrateQuery';
import { map } from 'rxjs/operators';
import AzureResourceGraphDatasource from './azure_resource_graph/azure_resource_graph_datasource';
import { getAzureCloud } from './credentials';
import migrateAnnotation from './utils/migrateAnnotation';
var Datasource = /** @class */ (function (_super) {
    __extends(Datasource, _super);
    function Datasource(instanceSettings, templateSrv) {
        var _a;
        if (templateSrv === void 0) { templateSrv = getTemplateSrv(); }
        var _this = _super.call(this, instanceSettings) || this;
        _this.templateSrv = templateSrv;
        _this.annotations = {
            prepareAnnotation: migrateAnnotation,
        };
        _this.pseudoDatasource = {};
        _this.azureMonitorDatasource = new AzureMonitorDatasource(instanceSettings);
        _this.azureLogAnalyticsDatasource = new AzureLogAnalyticsDatasource(instanceSettings);
        _this.azureResourceGraphDatasource = new AzureResourceGraphDatasource(instanceSettings);
        _this.resourcePickerData = new ResourcePickerData(instanceSettings);
        _this.pseudoDatasource = (_a = {},
            _a[AzureQueryType.AzureMonitor] = _this.azureMonitorDatasource,
            _a[AzureQueryType.LogAnalytics] = _this.azureLogAnalyticsDatasource,
            _a[AzureQueryType.AzureResourceGraph] = _this.azureResourceGraphDatasource,
            _a);
        var cloud = getAzureCloud(instanceSettings);
        if (cloud === 'azuremonitor' || cloud === 'chinaazuremonitor') {
            // AppInsights and InsightAnalytics are only supported for Public and Azure China clouds
            _this.appInsightsDatasource = new AppInsightsDatasource(instanceSettings);
            _this.insightsAnalyticsDatasource = new InsightsAnalyticsDatasource(instanceSettings);
            _this.pseudoDatasource[AzureQueryType.ApplicationInsights] = _this.appInsightsDatasource;
            _this.pseudoDatasource[AzureQueryType.InsightsAnalytics] = _this.insightsAnalyticsDatasource;
        }
        return _this;
    }
    Datasource.prototype.query = function (options) {
        var e_1, _a;
        var _this = this;
        var byType = new Map();
        try {
            for (var _b = __values(options.targets), _c = _b.next(); !_c.done; _c = _b.next()) {
                var baseTarget = _c.value;
                // Migrate old query structures
                var target = datasourceMigrations(baseTarget);
                // Skip hidden or invalid queries or ones without properties
                if (!target.queryType || target.hide || !hasQueryForType(target)) {
                    continue;
                }
                // Initialize the list of queries
                if (!byType.has(target.queryType)) {
                    var queryForType_1 = cloneDeep(options);
                    queryForType_1.requestId = queryForType_1.requestId + "-" + target.refId;
                    queryForType_1.targets = [];
                    byType.set(target.queryType, queryForType_1);
                }
                var queryForType = byType.get(target.queryType);
                queryForType === null || queryForType === void 0 ? void 0 : queryForType.targets.push(target);
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_1) throw e_1.error; }
        }
        var observables = Array.from(byType.entries()).map(function (_a) {
            var _b = __read(_a, 2), queryType = _b[0], req = _b[1];
            var ds = _this.pseudoDatasource[queryType];
            if (!ds) {
                throw new Error('Data source not created for query type ' + queryType);
            }
            return ds.query(req);
        });
        // Single query can skip merge
        if (observables.length === 1) {
            return observables[0];
        }
        if (observables.length > 1) {
            return forkJoin(observables).pipe(map(function (results) {
                var e_2, _a, e_3, _b;
                var data = [];
                try {
                    for (var results_1 = __values(results), results_1_1 = results_1.next(); !results_1_1.done; results_1_1 = results_1.next()) {
                        var result = results_1_1.value;
                        try {
                            for (var _c = (e_3 = void 0, __values(result.data)), _d = _c.next(); !_d.done; _d = _c.next()) {
                                var frame = _d.value;
                                data.push(frame);
                            }
                        }
                        catch (e_3_1) { e_3 = { error: e_3_1 }; }
                        finally {
                            try {
                                if (_d && !_d.done && (_b = _c.return)) _b.call(_c);
                            }
                            finally { if (e_3) throw e_3.error; }
                        }
                    }
                }
                catch (e_2_1) { e_2 = { error: e_2_1 }; }
                finally {
                    try {
                        if (results_1_1 && !results_1_1.done && (_a = results_1.return)) _a.call(results_1);
                    }
                    finally { if (e_2) throw e_2.error; }
                }
                return { state: LoadingState.Done, data: data };
            }));
        }
        return of({ state: LoadingState.Done, data: [] });
    };
    Datasource.prototype.annotationQuery = function (options) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.azureLogAnalyticsDatasource.annotationQuery(options)];
            });
        });
    };
    Datasource.prototype.metricFindQuery = function (query, optionalOptions) {
        var _a;
        return __awaiter(this, void 0, void 0, function () {
            var aiResult, amResult, alaResult;
            return __generator(this, function (_b) {
                if (!query) {
                    return [2 /*return*/, Promise.resolve([])];
                }
                aiResult = (_a = this.appInsightsDatasource) === null || _a === void 0 ? void 0 : _a.metricFindQueryInternal(query);
                if (aiResult) {
                    return [2 /*return*/, aiResult];
                }
                amResult = this.azureMonitorDatasource.metricFindQueryInternal(query);
                if (amResult) {
                    return [2 /*return*/, amResult];
                }
                alaResult = this.azureLogAnalyticsDatasource.metricFindQueryInternal(query, optionalOptions);
                if (alaResult) {
                    return [2 /*return*/, alaResult];
                }
                return [2 /*return*/, Promise.resolve([])];
            });
        });
    };
    Datasource.prototype.testDatasource = function () {
        var _a;
        return __awaiter(this, void 0, void 0, function () {
            var promises;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        promises = [];
                        promises.push(this.azureMonitorDatasource.testDatasource());
                        promises.push(this.azureLogAnalyticsDatasource.testDatasource());
                        if ((_a = this.appInsightsDatasource) === null || _a === void 0 ? void 0 : _a.isConfigured()) {
                            promises.push(this.appInsightsDatasource.testDatasource());
                        }
                        return [4 /*yield*/, Promise.all(promises).then(function (results) {
                                var status = 'success';
                                var message = '';
                                for (var i = 0; i < results.length; i++) {
                                    if (results[i].status !== 'success') {
                                        status = results[i].status;
                                    }
                                    message += i + 1 + ". " + results[i].message + " ";
                                }
                                return {
                                    status: status,
                                    message: message,
                                    title: upperFirst(status),
                                };
                            })];
                    case 1: return [2 /*return*/, _b.sent()];
                }
            });
        });
    };
    /* Azure Monitor REST API methods */
    Datasource.prototype.getResourceGroups = function (subscriptionId) {
        return this.azureMonitorDatasource.getResourceGroups(this.replaceTemplateVariable(subscriptionId));
    };
    Datasource.prototype.getMetricDefinitions = function (subscriptionId, resourceGroup) {
        return this.azureMonitorDatasource.getMetricDefinitions(this.replaceTemplateVariable(subscriptionId), this.replaceTemplateVariable(resourceGroup));
    };
    Datasource.prototype.getResourceNames = function (subscriptionId, resourceGroup, metricDefinition) {
        return this.azureMonitorDatasource.getResourceNames(this.replaceTemplateVariable(subscriptionId), this.replaceTemplateVariable(resourceGroup), this.replaceTemplateVariable(metricDefinition));
    };
    Datasource.prototype.getMetricNames = function (subscriptionId, resourceGroup, metricDefinition, resourceName, metricNamespace) {
        return this.azureMonitorDatasource.getMetricNames(this.replaceTemplateVariable(subscriptionId), this.replaceTemplateVariable(resourceGroup), this.replaceTemplateVariable(metricDefinition), this.replaceTemplateVariable(resourceName), this.replaceTemplateVariable(metricNamespace));
    };
    Datasource.prototype.getMetricNamespaces = function (subscriptionId, resourceGroup, metricDefinition, resourceName) {
        return this.azureMonitorDatasource.getMetricNamespaces(this.replaceTemplateVariable(subscriptionId), this.replaceTemplateVariable(resourceGroup), this.replaceTemplateVariable(metricDefinition), this.replaceTemplateVariable(resourceName));
    };
    Datasource.prototype.getMetricMetadata = function (subscriptionId, resourceGroup, metricDefinition, resourceName, metricNamespace, metricName) {
        return this.azureMonitorDatasource.getMetricMetadata(this.replaceTemplateVariable(subscriptionId), this.replaceTemplateVariable(resourceGroup), this.replaceTemplateVariable(metricDefinition), this.replaceTemplateVariable(resourceName), this.replaceTemplateVariable(metricNamespace), this.replaceTemplateVariable(metricName));
    };
    /* Application Insights API method */
    Datasource.prototype.getAppInsightsMetricNames = function () {
        var _a;
        return (_a = this.appInsightsDatasource) === null || _a === void 0 ? void 0 : _a.getMetricNames();
    };
    Datasource.prototype.getAppInsightsMetricMetadata = function (metricName) {
        var _a;
        return (_a = this.appInsightsDatasource) === null || _a === void 0 ? void 0 : _a.getMetricMetadata(metricName);
    };
    Datasource.prototype.getAppInsightsColumns = function (refId) {
        var _a;
        return (_a = this.appInsightsDatasource) === null || _a === void 0 ? void 0 : _a.logAnalyticsColumns[refId];
    };
    /*Azure Log Analytics */
    Datasource.prototype.getAzureLogAnalyticsWorkspaces = function (subscriptionId) {
        return this.azureLogAnalyticsDatasource.getWorkspaces(subscriptionId);
    };
    Datasource.prototype.getSubscriptions = function () {
        return this.azureMonitorDatasource.getSubscriptions();
    };
    Datasource.prototype.interpolateVariablesInQueries = function (queries, scopedVars) {
        var _this = this;
        var mapped = queries.map(function (query) {
            var _a;
            if (!query.queryType) {
                return query;
            }
            var ds = _this.pseudoDatasource[query.queryType];
            return (_a = ds === null || ds === void 0 ? void 0 : ds.applyTemplateVariables(query, scopedVars)) !== null && _a !== void 0 ? _a : query;
        });
        return mapped;
    };
    Datasource.prototype.replaceTemplateVariable = function (variable) {
        return this.templateSrv.replace(variable);
    };
    Datasource.prototype.getVariables = function () {
        return this.templateSrv.getVariables().map(function (v) { return "$" + v.name; });
    };
    Datasource.prototype.isTemplateVariable = function (value) {
        return this.getVariables().includes(value);
    };
    return Datasource;
}(DataSourceApi));
export default Datasource;
function hasQueryForType(query) {
    switch (query.queryType) {
        case AzureQueryType.AzureMonitor:
            return !!query.azureMonitor;
        case AzureQueryType.LogAnalytics:
            return !!query.azureLogAnalytics;
        case AzureQueryType.AzureResourceGraph:
            return !!query.azureResourceGraph;
        case AzureQueryType.ApplicationInsights:
            return !!query.appInsights;
        case AzureQueryType.InsightsAnalytics:
            return !!query.insightsAnalytics;
        default:
            return false;
    }
}
//# sourceMappingURL=datasource.js.map