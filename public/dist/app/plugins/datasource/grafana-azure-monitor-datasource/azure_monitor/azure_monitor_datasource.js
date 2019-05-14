import _ from 'lodash';
import AzureMonitorFilterBuilder from './azure_monitor_filter_builder';
import UrlBuilder from './url_builder';
import ResponseParser from './response_parser';
import SupportedNamespaces from './supported_namespaces';
import TimegrainConverter from '../time_grain_converter';
var AzureMonitorDatasource = /** @class */ (function () {
    /** @ngInject */
    function AzureMonitorDatasource(instanceSettings, backendSrv, templateSrv, $q) {
        this.instanceSettings = instanceSettings;
        this.backendSrv = backendSrv;
        this.templateSrv = templateSrv;
        this.$q = $q;
        this.apiVersion = '2018-01-01';
        this.defaultDropdownValue = 'select';
        this.supportedMetricNamespaces = [];
        this.id = instanceSettings.id;
        this.subscriptionId = instanceSettings.jsonData.subscriptionId;
        this.cloudName = instanceSettings.jsonData.cloudName || 'azuremonitor';
        this.baseUrl = "/" + this.cloudName + "/subscriptions/" + this.subscriptionId + "/resourceGroups";
        this.url = instanceSettings.url;
        this.supportedMetricNamespaces = new SupportedNamespaces(this.cloudName).get();
    }
    AzureMonitorDatasource.prototype.isConfigured = function () {
        return !!this.subscriptionId && this.subscriptionId.length > 0;
    };
    AzureMonitorDatasource.prototype.query = function (options) {
        var _this = this;
        var queries = _.filter(options.targets, function (item) {
            return (item.hide !== true &&
                item.azureMonitor.resourceGroup &&
                item.azureMonitor.resourceGroup !== _this.defaultDropdownValue &&
                item.azureMonitor.resourceName &&
                item.azureMonitor.resourceName !== _this.defaultDropdownValue &&
                item.azureMonitor.metricDefinition &&
                item.azureMonitor.metricDefinition !== _this.defaultDropdownValue &&
                item.azureMonitor.metricName &&
                item.azureMonitor.metricName !== _this.defaultDropdownValue);
        }).map(function (target) {
            var item = target.azureMonitor;
            if (item.timeGrainUnit && item.timeGrain !== 'auto') {
                item.timeGrain = TimegrainConverter.createISO8601Duration(item.timeGrain, item.timeGrainUnit);
            }
            var resourceGroup = _this.templateSrv.replace(item.resourceGroup, options.scopedVars);
            var resourceName = _this.templateSrv.replace(item.resourceName, options.scopedVars);
            var metricDefinition = _this.templateSrv.replace(item.metricDefinition, options.scopedVars);
            var timeGrain = _this.templateSrv.replace((item.timeGrain || '').toString(), options.scopedVars);
            var filterBuilder = new AzureMonitorFilterBuilder(item.metricName, options.range.from, options.range.to, timeGrain, options.interval);
            if (item.timeGrains) {
                filterBuilder.setAllowedTimeGrains(item.timeGrains);
            }
            if (item.aggregation) {
                filterBuilder.setAggregation(item.aggregation);
            }
            if (item.dimension && item.dimension !== 'None') {
                filterBuilder.setDimensionFilter(item.dimension, item.dimensionFilter);
            }
            var filter = _this.templateSrv.replace(filterBuilder.generateFilter(), options.scopedVars);
            var url = UrlBuilder.buildAzureMonitorQueryUrl(_this.baseUrl, resourceGroup, metricDefinition, resourceName, _this.apiVersion, filter);
            return {
                refId: target.refId,
                intervalMs: options.intervalMs,
                maxDataPoints: options.maxDataPoints,
                datasourceId: _this.id,
                url: url,
                format: options.format,
                alias: item.alias,
                raw: false,
            };
        });
        if (!queries || queries.length === 0) {
            return;
        }
        var promises = this.doQueries(queries);
        return this.$q.all(promises).then(function (results) {
            return new ResponseParser(results).parseQueryResult();
        });
    };
    AzureMonitorDatasource.prototype.doQueries = function (queries) {
        var _this = this;
        return _.map(queries, function (query) {
            return _this.doRequest(query.url)
                .then(function (result) {
                return {
                    result: result,
                    query: query,
                };
            })
                .catch(function (err) {
                throw {
                    error: err,
                    query: query,
                };
            });
        });
    };
    AzureMonitorDatasource.prototype.annotationQuery = function (options) { };
    AzureMonitorDatasource.prototype.metricFindQuery = function (query) {
        var resourceGroupsQuery = query.match(/^ResourceGroups\(\)/i);
        if (resourceGroupsQuery) {
            return this.getResourceGroups();
        }
        var metricDefinitionsQuery = query.match(/^Namespaces\(([^\)]+?)(,\s?([^,]+?))?\)/i);
        if (metricDefinitionsQuery) {
            return this.getMetricDefinitions(this.toVariable(metricDefinitionsQuery[1]));
        }
        var resourceNamesQuery = query.match(/^ResourceNames\(([^,]+?),\s?([^,]+?)\)/i);
        if (resourceNamesQuery) {
            var resourceGroup = this.toVariable(resourceNamesQuery[1]);
            var metricDefinition = this.toVariable(resourceNamesQuery[2]);
            return this.getResourceNames(resourceGroup, metricDefinition);
        }
        var metricNamesQuery = query.match(/^MetricNames\(([^,]+?),\s?([^,]+?),\s?(.+?)\)/i);
        if (metricNamesQuery) {
            var resourceGroup = this.toVariable(metricNamesQuery[1]);
            var metricDefinition = this.toVariable(metricNamesQuery[2]);
            var resourceName = this.toVariable(metricNamesQuery[3]);
            return this.getMetricNames(resourceGroup, metricDefinition, resourceName);
        }
        return undefined;
    };
    AzureMonitorDatasource.prototype.toVariable = function (metric) {
        return this.templateSrv.replace((metric || '').trim());
    };
    AzureMonitorDatasource.prototype.getResourceGroups = function () {
        var url = this.baseUrl + "?api-version=" + this.apiVersion;
        return this.doRequest(url).then(function (result) {
            return ResponseParser.parseResponseValues(result, 'name', 'name');
        });
    };
    AzureMonitorDatasource.prototype.getMetricDefinitions = function (resourceGroup) {
        var _this = this;
        var url = this.baseUrl + "/" + resourceGroup + "/resources?api-version=" + this.apiVersion;
        return this.doRequest(url)
            .then(function (result) {
            return ResponseParser.parseResponseValues(result, 'type', 'type');
        })
            .then(function (result) {
            return _.filter(result, function (t) {
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
            return result;
        });
    };
    AzureMonitorDatasource.prototype.getResourceNames = function (resourceGroup, metricDefinition) {
        var url = this.baseUrl + "/" + resourceGroup + "/resources?api-version=" + this.apiVersion;
        return this.doRequest(url).then(function (result) {
            if (!_.startsWith(metricDefinition, 'Microsoft.Storage/storageAccounts/')) {
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
    AzureMonitorDatasource.prototype.getMetricNames = function (resourceGroup, metricDefinition, resourceName) {
        var url = UrlBuilder.buildAzureMonitorGetMetricNamesUrl(this.baseUrl, resourceGroup, metricDefinition, resourceName, this.apiVersion);
        return this.doRequest(url).then(function (result) {
            return ResponseParser.parseResponseValues(result, 'name.localizedValue', 'name.value');
        });
    };
    AzureMonitorDatasource.prototype.getMetricMetadata = function (resourceGroup, metricDefinition, resourceName, metricName) {
        var url = UrlBuilder.buildAzureMonitorGetMetricNamesUrl(this.baseUrl, resourceGroup, metricDefinition, resourceName, this.apiVersion);
        return this.doRequest(url).then(function (result) {
            return ResponseParser.parseMetadata(result, metricName);
        });
    };
    AzureMonitorDatasource.prototype.testDatasource = function () {
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
        var url = this.baseUrl + "?api-version=" + this.apiVersion;
        return this.doRequest(url)
            .then(function (response) {
            if (response.status === 200) {
                return {
                    status: 'success',
                    message: 'Successfully queried the Azure Monitor service.',
                    title: 'Success',
                };
            }
            return {
                status: 'error',
                message: 'Returned http status code ' + response.status,
            };
        })
            .catch(function (error) {
            var message = 'Azure Monitor: ';
            message += error.statusText ? error.statusText + ': ' : '';
            if (error.data && error.data.error && error.data.error.code) {
                message += error.data.error.code + '. ' + error.data.error.message;
            }
            else if (error.data && error.data.error) {
                message += error.data.error;
            }
            else if (error.data) {
                message += error.data;
            }
            else {
                message += 'Cannot connect to Azure Monitor REST API.';
            }
            return {
                status: 'error',
                message: message,
            };
        });
    };
    AzureMonitorDatasource.prototype.isValidConfigField = function (field) {
        return field && field.length > 0;
    };
    AzureMonitorDatasource.prototype.doRequest = function (url, maxRetries) {
        var _this = this;
        if (maxRetries === void 0) { maxRetries = 1; }
        return this.backendSrv
            .datasourceRequest({
            url: this.url + url,
            method: 'GET',
        })
            .catch(function (error) {
            if (maxRetries > 0) {
                return _this.doRequest(url, maxRetries - 1);
            }
            throw error;
        });
    };
    return AzureMonitorDatasource;
}());
export default AzureMonitorDatasource;
//# sourceMappingURL=azure_monitor_datasource.js.map