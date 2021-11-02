import { __awaiter, __extends, __generator } from "tslib";
import { filter, startsWith } from 'lodash';
import UrlBuilder from './url_builder';
import ResponseParser from './response_parser';
import SupportedNamespaces from './supported_namespaces';
import TimegrainConverter from '../time_grain_converter';
import { AzureQueryType, } from '../types';
import { DataSourceWithBackend, getTemplateSrv } from '@grafana/runtime';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { getAuthType, getAzureCloud, getAzurePortalUrl } from '../credentials';
import { resourceTypeDisplayNames } from '../azureMetadata';
import { routeNames } from '../utils/common';
var defaultDropdownValue = 'select';
var AzureMonitorDatasource = /** @class */ (function (_super) {
    __extends(AzureMonitorDatasource, _super);
    function AzureMonitorDatasource(instanceSettings) {
        var _this = _super.call(this, instanceSettings) || this;
        _this.instanceSettings = instanceSettings;
        _this.apiVersion = '2018-01-01';
        _this.apiPreviewVersion = '2017-12-01-preview';
        _this.supportedMetricNamespaces = [];
        _this.timeSrv = getTimeSrv();
        _this.defaultSubscriptionId = instanceSettings.jsonData.subscriptionId;
        var cloud = getAzureCloud(instanceSettings);
        _this.resourcePath = routeNames.azureMonitor + "/subscriptions";
        _this.supportedMetricNamespaces = new SupportedNamespaces(cloud).get();
        _this.azurePortalUrl = getAzurePortalUrl(cloud);
        return _this;
    }
    AzureMonitorDatasource.prototype.isConfigured = function () {
        // If validation didn't return any error then the data source is properly configured
        return !this.validateDatasource();
    };
    AzureMonitorDatasource.prototype.filterQuery = function (item) {
        return !!(item.hide !== true &&
            item.azureMonitor &&
            item.azureMonitor.resourceGroup &&
            item.azureMonitor.resourceGroup !== defaultDropdownValue &&
            item.azureMonitor.resourceName &&
            item.azureMonitor.resourceName !== defaultDropdownValue &&
            item.azureMonitor.metricDefinition &&
            item.azureMonitor.metricDefinition !== defaultDropdownValue &&
            item.azureMonitor.metricName &&
            item.azureMonitor.metricName !== defaultDropdownValue &&
            item.azureMonitor.aggregation &&
            item.azureMonitor.aggregation !== defaultDropdownValue);
    };
    AzureMonitorDatasource.prototype.applyTemplateVariables = function (target, scopedVars) {
        var _a;
        var item = target.azureMonitor;
        if (!item) {
            // return target;
            throw new Error('Query is not a valid Azure Monitor Metrics query');
        }
        // fix for timeGrainUnit which is a deprecated/removed field name
        if (item.timeGrain && item.timeGrainUnit && item.timeGrain !== 'auto') {
            item.timeGrain = TimegrainConverter.createISO8601Duration(item.timeGrain, item.timeGrainUnit);
        }
        var templateSrv = getTemplateSrv();
        var subscriptionId = templateSrv.replace(target.subscription || this.defaultSubscriptionId, scopedVars);
        var resourceGroup = templateSrv.replace(item.resourceGroup, scopedVars);
        var resourceName = templateSrv.replace(item.resourceName, scopedVars);
        var metricNamespace = templateSrv.replace(item.metricNamespace, scopedVars);
        var metricDefinition = templateSrv.replace(item.metricDefinition, scopedVars);
        var timeGrain = templateSrv.replace((item.timeGrain || '').toString(), scopedVars);
        var aggregation = templateSrv.replace(item.aggregation, scopedVars);
        var top = templateSrv.replace(item.top || '', scopedVars);
        var dimensionFilters = ((_a = item.dimensionFilters) !== null && _a !== void 0 ? _a : [])
            .filter(function (f) { return f.dimension && f.dimension !== 'None'; })
            .map(function (f) {
            var _a;
            var filter = templateSrv.replace((_a = f.filter) !== null && _a !== void 0 ? _a : '', scopedVars);
            return {
                dimension: templateSrv.replace(f.dimension, scopedVars),
                operator: f.operator || 'eq',
                filter: filter || '*', // send * when empty
            };
        });
        return {
            refId: target.refId,
            subscription: subscriptionId,
            queryType: AzureQueryType.AzureMonitor,
            azureMonitor: {
                resourceGroup: resourceGroup,
                resourceName: resourceName,
                metricDefinition: metricDefinition,
                timeGrain: timeGrain,
                allowedTimeGrainsMs: item.allowedTimeGrainsMs,
                metricName: templateSrv.replace(item.metricName, scopedVars),
                metricNamespace: metricNamespace && metricNamespace !== defaultDropdownValue ? metricNamespace : metricDefinition,
                aggregation: aggregation,
                dimensionFilters: dimensionFilters,
                top: top || '10',
                alias: item.alias,
            },
        };
    };
    /**
     * This is named differently than DataSourceApi.metricFindQuery
     * because it's not exposed to Grafana like the main AzureMonitorDataSource.
     * And some of the azure internal data sources return null in this function, which the
     * external interface does not support
     */
    AzureMonitorDatasource.prototype.metricFindQueryInternal = function (query) {
        var subscriptionsQuery = query.match(/^Subscriptions\(\)/i);
        if (subscriptionsQuery) {
            return this.getSubscriptions();
        }
        var resourceGroupsQuery = query.match(/^ResourceGroups\(\)/i);
        if (resourceGroupsQuery && this.defaultSubscriptionId) {
            return this.getResourceGroups(this.defaultSubscriptionId);
        }
        var resourceGroupsQueryWithSub = query.match(/^ResourceGroups\(([^\)]+?)(,\s?([^,]+?))?\)/i);
        if (resourceGroupsQueryWithSub) {
            return this.getResourceGroups(this.toVariable(resourceGroupsQueryWithSub[1]));
        }
        var metricDefinitionsQuery = query.match(/^Namespaces\(([^\)]+?)(,\s?([^,]+?))?\)/i);
        if (metricDefinitionsQuery && this.defaultSubscriptionId) {
            if (!metricDefinitionsQuery[3]) {
                return this.getMetricDefinitions(this.defaultSubscriptionId, this.toVariable(metricDefinitionsQuery[1]));
            }
        }
        var metricDefinitionsQueryWithSub = query.match(/^Namespaces\(([^,]+?),\s?([^,]+?)\)/i);
        if (metricDefinitionsQueryWithSub) {
            return this.getMetricDefinitions(this.toVariable(metricDefinitionsQueryWithSub[1]), this.toVariable(metricDefinitionsQueryWithSub[2]));
        }
        var resourceNamesQuery = query.match(/^ResourceNames\(([^,]+?),\s?([^,]+?)\)/i);
        if (resourceNamesQuery && this.defaultSubscriptionId) {
            var resourceGroup = this.toVariable(resourceNamesQuery[1]);
            var metricDefinition = this.toVariable(resourceNamesQuery[2]);
            return this.getResourceNames(this.defaultSubscriptionId, resourceGroup, metricDefinition);
        }
        var resourceNamesQueryWithSub = query.match(/^ResourceNames\(([^,]+?),\s?([^,]+?),\s?(.+?)\)/i);
        if (resourceNamesQueryWithSub) {
            var subscription = this.toVariable(resourceNamesQueryWithSub[1]);
            var resourceGroup = this.toVariable(resourceNamesQueryWithSub[2]);
            var metricDefinition = this.toVariable(resourceNamesQueryWithSub[3]);
            return this.getResourceNames(subscription, resourceGroup, metricDefinition);
        }
        var metricNamespaceQuery = query.match(/^MetricNamespace\(([^,]+?),\s?([^,]+?),\s?([^,]+?)\)/i);
        if (metricNamespaceQuery && this.defaultSubscriptionId) {
            var resourceGroup = this.toVariable(metricNamespaceQuery[1]);
            var metricDefinition = this.toVariable(metricNamespaceQuery[2]);
            var resourceName = this.toVariable(metricNamespaceQuery[3]);
            return this.getMetricNamespaces(this.defaultSubscriptionId, resourceGroup, metricDefinition, resourceName);
        }
        var metricNamespaceQueryWithSub = query.match(/^metricnamespace\(([^,]+?),\s?([^,]+?),\s?([^,]+?),\s?([^,]+?)\)/i);
        if (metricNamespaceQueryWithSub) {
            var subscription = this.toVariable(metricNamespaceQueryWithSub[1]);
            var resourceGroup = this.toVariable(metricNamespaceQueryWithSub[2]);
            var metricDefinition = this.toVariable(metricNamespaceQueryWithSub[3]);
            var resourceName = this.toVariable(metricNamespaceQueryWithSub[4]);
            return this.getMetricNamespaces(subscription, resourceGroup, metricDefinition, resourceName);
        }
        var metricNamesQuery = query.match(/^MetricNames\(([^,]+?),\s?([^,]+?),\s?([^,]+?),\s?([^,]+?)\)/i);
        if (metricNamesQuery && this.defaultSubscriptionId) {
            if (metricNamesQuery[3].indexOf(',') === -1) {
                var resourceGroup = this.toVariable(metricNamesQuery[1]);
                var metricDefinition = this.toVariable(metricNamesQuery[2]);
                var resourceName = this.toVariable(metricNamesQuery[3]);
                var metricNamespace = this.toVariable(metricNamesQuery[4]);
                return this.getMetricNames(this.defaultSubscriptionId, resourceGroup, metricDefinition, resourceName, metricNamespace);
            }
        }
        var metricNamesQueryWithSub = query.match(/^MetricNames\(([^,]+?),\s?([^,]+?),\s?([^,]+?),\s?([^,]+?),\s?(.+?)\)/i);
        if (metricNamesQueryWithSub) {
            var subscription = this.toVariable(metricNamesQueryWithSub[1]);
            var resourceGroup = this.toVariable(metricNamesQueryWithSub[2]);
            var metricDefinition = this.toVariable(metricNamesQueryWithSub[3]);
            var resourceName = this.toVariable(metricNamesQueryWithSub[4]);
            var metricNamespace = this.toVariable(metricNamesQueryWithSub[5]);
            return this.getMetricNames(subscription, resourceGroup, metricDefinition, resourceName, metricNamespace);
        }
        return null;
    };
    AzureMonitorDatasource.prototype.toVariable = function (metric) {
        return getTemplateSrv().replace((metric || '').trim());
    };
    AzureMonitorDatasource.prototype.getSubscriptions = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (!this.isConfigured()) {
                    return [2 /*return*/, []];
                }
                return [2 /*return*/, this.getResource(this.resourcePath + "?api-version=2019-03-01").then(function (result) {
                        return ResponseParser.parseSubscriptions(result);
                    })];
            });
        });
    };
    AzureMonitorDatasource.prototype.getResourceGroups = function (subscriptionId) {
        return this.getResource(this.resourcePath + "/" + subscriptionId + "/resourceGroups?api-version=" + this.apiVersion).then(function (result) {
            return ResponseParser.parseResponseValues(result, 'name', 'name');
        });
    };
    AzureMonitorDatasource.prototype.getMetricDefinitions = function (subscriptionId, resourceGroup) {
        var _this = this;
        return this.getResource(this.resourcePath + "/" + subscriptionId + "/resourceGroups/" + resourceGroup + "/resources?api-version=" + this.apiVersion)
            .then(function (result) {
            return ResponseParser.parseResponseValues(result, 'type', 'type');
        })
            .then(function (result) {
            return filter(result, function (t) {
                for (var i = 0; i < _this.supportedMetricNamespaces.length; i++) {
                    if (t.value.toLowerCase() === _this.supportedMetricNamespaces[i].toLowerCase()) {
                        return true;
                    }
                }
                return false;
            });
        })
            .then(function (result) {
            var shouldHardcodeBlobStorage = false;
            for (var i = 0; i < result.length; i++) {
                if (result[i].value === 'Microsoft.Storage/storageAccounts') {
                    shouldHardcodeBlobStorage = true;
                    break;
                }
            }
            if (shouldHardcodeBlobStorage) {
                result.push({
                    text: 'Microsoft.Storage/storageAccounts/blobServices',
                    value: 'Microsoft.Storage/storageAccounts/blobServices',
                });
                result.push({
                    text: 'Microsoft.Storage/storageAccounts/fileServices',
                    value: 'Microsoft.Storage/storageAccounts/fileServices',
                });
                result.push({
                    text: 'Microsoft.Storage/storageAccounts/tableServices',
                    value: 'Microsoft.Storage/storageAccounts/tableServices',
                });
                result.push({
                    text: 'Microsoft.Storage/storageAccounts/queueServices',
                    value: 'Microsoft.Storage/storageAccounts/queueServices',
                });
            }
            return result.map(function (v) { return ({
                value: v.value,
                text: resourceTypeDisplayNames[v.value.toLowerCase()] || v.value,
            }); });
        });
    };
    AzureMonitorDatasource.prototype.getResourceNames = function (subscriptionId, resourceGroup, metricDefinition) {
        return this.getResource(this.resourcePath + "/" + subscriptionId + "/resourceGroups/" + resourceGroup + "/resources?api-version=" + this.apiVersion).then(function (result) {
            if (!startsWith(metricDefinition, 'Microsoft.Storage/storageAccounts/')) {
                return ResponseParser.parseResourceNames(result, metricDefinition);
            }
            var list = ResponseParser.parseResourceNames(result, 'Microsoft.Storage/storageAccounts');
            for (var i = 0; i < list.length; i++) {
                list[i].text += '/default';
                list[i].value += '/default';
            }
            return list;
        });
    };
    AzureMonitorDatasource.prototype.getMetricNamespaces = function (subscriptionId, resourceGroup, metricDefinition, resourceName) {
        var url = UrlBuilder.buildAzureMonitorGetMetricNamespacesUrl(this.resourcePath, subscriptionId, resourceGroup, metricDefinition, resourceName, this.apiPreviewVersion);
        return this.getResource(url).then(function (result) {
            return ResponseParser.parseResponseValues(result, 'name', 'properties.metricNamespaceName');
        });
    };
    AzureMonitorDatasource.prototype.getMetricNames = function (subscriptionId, resourceGroup, metricDefinition, resourceName, metricNamespace) {
        var url = UrlBuilder.buildAzureMonitorGetMetricNamesUrl(this.resourcePath, subscriptionId, resourceGroup, metricDefinition, resourceName, metricNamespace, this.apiVersion);
        return this.getResource(url).then(function (result) {
            return ResponseParser.parseResponseValues(result, 'name.localizedValue', 'name.value');
        });
    };
    AzureMonitorDatasource.prototype.getMetricMetadata = function (subscriptionId, resourceGroup, metricDefinition, resourceName, metricNamespace, metricName) {
        var url = UrlBuilder.buildAzureMonitorGetMetricNamesUrl(this.resourcePath, subscriptionId, resourceGroup, metricDefinition, resourceName, metricNamespace, this.apiVersion);
        return this.getResource(url).then(function (result) {
            return ResponseParser.parseMetadata(result, metricName);
        });
    };
    AzureMonitorDatasource.prototype.testDatasource = function () {
        return __awaiter(this, void 0, void 0, function () {
            var validationError, url, e_1, message;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        validationError = this.validateDatasource();
                        if (validationError) {
                            return [2 /*return*/, Promise.resolve(validationError)];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        url = this.resourcePath + "?api-version=2019-03-01";
                        return [4 /*yield*/, this.getResource(url).then(function (response) {
                                return {
                                    status: 'success',
                                    message: 'Successfully queried the Azure Monitor service.',
                                    title: 'Success',
                                };
                            })];
                    case 2: return [2 /*return*/, _a.sent()];
                    case 3:
                        e_1 = _a.sent();
                        message = 'Azure Monitor: ';
                        message += e_1.statusText ? e_1.statusText + ': ' : '';
                        if (e_1.data && e_1.data.error && e_1.data.error.code) {
                            message += e_1.data.error.code + '. ' + e_1.data.error.message;
                        }
                        else if (e_1.data && e_1.data.error) {
                            message += e_1.data.error;
                        }
                        else if (e_1.data) {
                            message += e_1.data;
                        }
                        else {
                            message += 'Cannot connect to Azure Monitor REST API.';
                        }
                        return [2 /*return*/, {
                                status: 'error',
                                message: message,
                            }];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    AzureMonitorDatasource.prototype.validateDatasource = function () {
        var authType = getAuthType(this.instanceSettings);
        if (authType === 'clientsecret') {
            if (!this.isValidConfigField(this.instanceSettings.jsonData.tenantId)) {
                return {
                    status: 'error',
                    message: 'The Tenant Id field is required.',
                };
            }
            if (!this.isValidConfigField(this.instanceSettings.jsonData.clientId)) {
                return {
                    status: 'error',
                    message: 'The Client Id field is required.',
                };
            }
        }
        return undefined;
    };
    AzureMonitorDatasource.prototype.isValidConfigField = function (field) {
        return typeof field === 'string' && field.length > 0;
    };
    return AzureMonitorDatasource;
}(DataSourceWithBackend));
export default AzureMonitorDatasource;
//# sourceMappingURL=azure_monitor_datasource.js.map