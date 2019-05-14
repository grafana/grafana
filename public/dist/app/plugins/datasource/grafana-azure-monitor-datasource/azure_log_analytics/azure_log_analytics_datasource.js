import _ from 'lodash';
import LogAnalyticsQuerystringBuilder from '../log_analytics/querystring_builder';
import ResponseParser from './response_parser';
var AzureLogAnalyticsDatasource = /** @class */ (function () {
    /** @ngInject */
    function AzureLogAnalyticsDatasource(instanceSettings, backendSrv, templateSrv, $q) {
        this.instanceSettings = instanceSettings;
        this.backendSrv = backendSrv;
        this.templateSrv = templateSrv;
        this.$q = $q;
        this.id = instanceSettings.id;
        this.baseUrl = this.instanceSettings.jsonData.azureLogAnalyticsSameAs
            ? '/sameasloganalyticsazure'
            : "/loganalyticsazure";
        this.url = instanceSettings.url;
        this.defaultOrFirstWorkspace = this.instanceSettings.jsonData.logAnalyticsDefaultWorkspace;
        this.setWorkspaceUrl();
    }
    AzureLogAnalyticsDatasource.prototype.isConfigured = function () {
        return ((!!this.instanceSettings.jsonData.logAnalyticsSubscriptionId &&
            this.instanceSettings.jsonData.logAnalyticsSubscriptionId.length > 0) ||
            !!this.instanceSettings.jsonData.azureLogAnalyticsSameAs);
    };
    AzureLogAnalyticsDatasource.prototype.setWorkspaceUrl = function () {
        if (!!this.instanceSettings.jsonData.subscriptionId || !!this.instanceSettings.jsonData.azureLogAnalyticsSameAs) {
            this.subscriptionId = this.instanceSettings.jsonData.subscriptionId;
            var azureCloud = this.instanceSettings.jsonData.cloudName || 'azuremonitor';
            this.azureMonitorUrl = "/" + azureCloud + "/subscriptions/" + this.subscriptionId;
        }
        else {
            this.subscriptionId = this.instanceSettings.jsonData.logAnalyticsSubscriptionId;
            this.azureMonitorUrl = "/workspacesloganalytics/subscriptions/" + this.subscriptionId;
        }
    };
    AzureLogAnalyticsDatasource.prototype.getWorkspaces = function () {
        var workspaceListUrl = this.azureMonitorUrl + '/providers/Microsoft.OperationalInsights/workspaces?api-version=2017-04-26-preview';
        return this.doRequest(workspaceListUrl).then(function (response) {
            return (_.map(response.data.value, function (val) {
                return { text: val.name, value: val.properties.customerId };
            }) || []);
        });
    };
    AzureLogAnalyticsDatasource.prototype.getSchema = function (workspace) {
        if (!workspace) {
            return Promise.resolve();
        }
        var url = this.baseUrl + "/" + workspace + "/metadata";
        return this.doRequest(url).then(function (response) {
            return new ResponseParser(response.data).parseSchemaResult();
        });
    };
    AzureLogAnalyticsDatasource.prototype.query = function (options) {
        var _this = this;
        var queries = _.filter(options.targets, function (item) {
            return item.hide !== true;
        }).map(function (target) {
            var item = target.azureLogAnalytics;
            var querystringBuilder = new LogAnalyticsQuerystringBuilder(_this.templateSrv.replace(item.query, options.scopedVars, _this.interpolateVariable), options, 'TimeGenerated');
            var generated = querystringBuilder.generate();
            var url = _this.baseUrl + "/" + item.workspace + "/query?" + generated.uriString;
            return {
                refId: target.refId,
                intervalMs: options.intervalMs,
                maxDataPoints: options.maxDataPoints,
                datasourceId: _this.id,
                url: url,
                query: generated.rawQuery,
                format: options.format,
                resultFormat: item.resultFormat,
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
    AzureLogAnalyticsDatasource.prototype.metricFindQuery = function (query) {
        var _this = this;
        return this.getDefaultOrFirstWorkspace().then(function (workspace) {
            var queries = _this.buildQuery(query, null, workspace);
            var promises = _this.doQueries(queries);
            return _this.$q
                .all(promises)
                .then(function (results) {
                return new ResponseParser(results).parseToVariables();
            })
                .catch(function (err) {
                if (err.error &&
                    err.error.data &&
                    err.error.data.error &&
                    err.error.data.error.innererror &&
                    err.error.data.error.innererror.innererror) {
                    throw { message: err.error.data.error.innererror.innererror.message };
                }
                else if (err.error && err.error.data && err.error.data.error) {
                    throw { message: err.error.data.error.message };
                }
            });
        });
    };
    AzureLogAnalyticsDatasource.prototype.buildQuery = function (query, options, workspace) {
        var querystringBuilder = new LogAnalyticsQuerystringBuilder(this.templateSrv.replace(query, {}, this.interpolateVariable), options, 'TimeGenerated');
        var querystring = querystringBuilder.generate().uriString;
        var url = this.baseUrl + "/" + workspace + "/query?" + querystring;
        var queries = [];
        queries.push({
            datasourceId: this.id,
            url: url,
            resultFormat: 'table',
        });
        return queries;
    };
    AzureLogAnalyticsDatasource.prototype.interpolateVariable = function (value, variable) {
        if (typeof value === 'string') {
            if (variable.multi || variable.includeAll) {
                return "'" + value + "'";
            }
            else {
                return value;
            }
        }
        if (typeof value === 'number') {
            return value;
        }
        var quotedValues = _.map(value, function (val) {
            if (typeof value === 'number') {
                return value;
            }
            return "'" + val + "'";
        });
        return quotedValues.join(',');
    };
    AzureLogAnalyticsDatasource.prototype.getDefaultOrFirstWorkspace = function () {
        var _this = this;
        if (this.defaultOrFirstWorkspace) {
            return Promise.resolve(this.defaultOrFirstWorkspace);
        }
        return this.getWorkspaces().then(function (workspaces) {
            _this.defaultOrFirstWorkspace = workspaces[0].value;
            return _this.defaultOrFirstWorkspace;
        });
    };
    AzureLogAnalyticsDatasource.prototype.annotationQuery = function (options) {
        if (!options.annotation.rawQuery) {
            return this.$q.reject({
                message: 'Query missing in annotation definition',
            });
        }
        var queries = this.buildQuery(options.annotation.rawQuery, options, options.annotation.workspace);
        var promises = this.doQueries(queries);
        return this.$q.all(promises).then(function (results) {
            var annotations = new ResponseParser(results).transformToAnnotations(options);
            return annotations;
        });
    };
    AzureLogAnalyticsDatasource.prototype.doQueries = function (queries) {
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
    AzureLogAnalyticsDatasource.prototype.doRequest = function (url, maxRetries) {
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
    AzureLogAnalyticsDatasource.prototype.testDatasource = function () {
        var _this = this;
        var validationError = this.isValidConfig();
        if (validationError) {
            return validationError;
        }
        return this.getDefaultOrFirstWorkspace()
            .then(function (ws) {
            var url = _this.baseUrl + "/" + ws + "/metadata";
            return _this.doRequest(url);
        })
            .then(function (response) {
            if (response.status === 200) {
                return {
                    status: 'success',
                    message: 'Successfully queried the Azure Log Analytics service.',
                    title: 'Success',
                };
            }
            return {
                status: 'error',
                message: 'Returned http status code ' + response.status,
            };
        })
            .catch(function (error) {
            var message = 'Azure Log Analytics: ';
            if (error.config && error.config.url && error.config.url.indexOf('workspacesloganalytics') > -1) {
                message = 'Azure Log Analytics requires access to Azure Monitor but had the following error: ';
            }
            message = _this.getErrorMessage(message, error);
            return {
                status: 'error',
                message: message,
            };
        });
    };
    AzureLogAnalyticsDatasource.prototype.getErrorMessage = function (message, error) {
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
            message += 'Cannot connect to Azure Log Analytics REST API.';
        }
        return message;
    };
    AzureLogAnalyticsDatasource.prototype.isValidConfig = function () {
        if (this.instanceSettings.jsonData.azureLogAnalyticsSameAs) {
            return undefined;
        }
        if (!this.isValidConfigField(this.instanceSettings.jsonData.logAnalyticsSubscriptionId)) {
            return {
                status: 'error',
                message: 'The Subscription Id field is required.',
            };
        }
        if (!this.isValidConfigField(this.instanceSettings.jsonData.logAnalyticsTenantId)) {
            return {
                status: 'error',
                message: 'The Tenant Id field is required.',
            };
        }
        if (!this.isValidConfigField(this.instanceSettings.jsonData.logAnalyticsClientId)) {
            return {
                status: 'error',
                message: 'The Client Id field is required.',
            };
        }
        return undefined;
    };
    AzureLogAnalyticsDatasource.prototype.isValidConfigField = function (field) {
        return field && field.length > 0;
    };
    return AzureLogAnalyticsDatasource;
}());
export default AzureLogAnalyticsDatasource;
//# sourceMappingURL=azure_log_analytics_datasource.js.map