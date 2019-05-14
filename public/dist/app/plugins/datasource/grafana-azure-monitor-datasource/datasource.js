import _ from 'lodash';
import AzureMonitorDatasource from './azure_monitor/azure_monitor_datasource';
import AppInsightsDatasource from './app_insights/app_insights_datasource';
import AzureLogAnalyticsDatasource from './azure_log_analytics/azure_log_analytics_datasource';
var Datasource = /** @class */ (function () {
    /** @ngInject */
    function Datasource(instanceSettings, backendSrv, templateSrv, $q) {
        this.backendSrv = backendSrv;
        this.templateSrv = templateSrv;
        this.$q = $q;
        this.name = instanceSettings.name;
        this.id = instanceSettings.id;
        this.azureMonitorDatasource = new AzureMonitorDatasource(instanceSettings, this.backendSrv, this.templateSrv, this.$q);
        this.appInsightsDatasource = new AppInsightsDatasource(instanceSettings, this.backendSrv, this.templateSrv, this.$q);
        this.azureLogAnalyticsDatasource = new AzureLogAnalyticsDatasource(instanceSettings, this.backendSrv, this.templateSrv, this.$q);
    }
    Datasource.prototype.query = function (options) {
        var promises = [];
        var azureMonitorOptions = _.cloneDeep(options);
        var appInsightsTargets = _.cloneDeep(options);
        var azureLogAnalyticsTargets = _.cloneDeep(options);
        azureMonitorOptions.targets = _.filter(azureMonitorOptions.targets, ['queryType', 'Azure Monitor']);
        appInsightsTargets.targets = _.filter(appInsightsTargets.targets, ['queryType', 'Application Insights']);
        azureLogAnalyticsTargets.targets = _.filter(azureLogAnalyticsTargets.targets, ['queryType', 'Azure Log Analytics']);
        if (azureMonitorOptions.targets.length > 0) {
            var amPromise = this.azureMonitorDatasource.query(azureMonitorOptions);
            if (amPromise) {
                promises.push(amPromise);
            }
        }
        if (appInsightsTargets.targets.length > 0) {
            var aiPromise = this.appInsightsDatasource.query(appInsightsTargets);
            if (aiPromise) {
                promises.push(aiPromise);
            }
        }
        if (azureLogAnalyticsTargets.targets.length > 0) {
            var alaPromise = this.azureLogAnalyticsDatasource.query(azureLogAnalyticsTargets);
            if (alaPromise) {
                promises.push(alaPromise);
            }
        }
        if (promises.length === 0) {
            return this.$q.when({ data: [] });
        }
        return Promise.all(promises).then(function (results) {
            return { data: _.flatten(results) };
        });
    };
    Datasource.prototype.annotationQuery = function (options) {
        return this.azureLogAnalyticsDatasource.annotationQuery(options);
    };
    Datasource.prototype.metricFindQuery = function (query) {
        if (!query) {
            return Promise.resolve([]);
        }
        var aiResult = this.appInsightsDatasource.metricFindQuery(query);
        if (aiResult) {
            return aiResult;
        }
        var amResult = this.azureMonitorDatasource.metricFindQuery(query);
        if (amResult) {
            return amResult;
        }
        var alaResult = this.azureLogAnalyticsDatasource.metricFindQuery(query);
        if (alaResult) {
            return alaResult;
        }
        return Promise.resolve([]);
    };
    Datasource.prototype.testDatasource = function () {
        var promises = [];
        if (this.azureMonitorDatasource.isConfigured()) {
            promises.push(this.azureMonitorDatasource.testDatasource());
        }
        if (this.appInsightsDatasource.isConfigured()) {
            promises.push(this.appInsightsDatasource.testDatasource());
        }
        if (this.azureLogAnalyticsDatasource.isConfigured()) {
            promises.push(this.azureLogAnalyticsDatasource.testDatasource());
        }
        if (promises.length === 0) {
            return {
                status: 'error',
                message: "Nothing configured. At least one of the API's must be configured.",
                title: 'Error',
            };
        }
        return this.$q.all(promises).then(function (results) {
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
                title: _.upperFirst(status),
            };
        });
    };
    /* Azure Monitor REST API methods */
    Datasource.prototype.getResourceGroups = function () {
        return this.azureMonitorDatasource.getResourceGroups();
    };
    Datasource.prototype.getMetricDefinitions = function (resourceGroup) {
        return this.azureMonitorDatasource.getMetricDefinitions(resourceGroup);
    };
    Datasource.prototype.getResourceNames = function (resourceGroup, metricDefinition) {
        return this.azureMonitorDatasource.getResourceNames(resourceGroup, metricDefinition);
    };
    Datasource.prototype.getMetricNames = function (resourceGroup, metricDefinition, resourceName) {
        return this.azureMonitorDatasource.getMetricNames(resourceGroup, metricDefinition, resourceName);
    };
    Datasource.prototype.getMetricMetadata = function (resourceGroup, metricDefinition, resourceName, metricName) {
        return this.azureMonitorDatasource.getMetricMetadata(resourceGroup, metricDefinition, resourceName, metricName);
    };
    /* Application Insights API method */
    Datasource.prototype.getAppInsightsMetricNames = function () {
        return this.appInsightsDatasource.getMetricNames();
    };
    Datasource.prototype.getAppInsightsMetricMetadata = function (metricName) {
        return this.appInsightsDatasource.getMetricMetadata(metricName);
    };
    Datasource.prototype.getAppInsightsColumns = function (refId) {
        return this.appInsightsDatasource.logAnalyticsColumns[refId];
    };
    /*Azure Log Analytics */
    Datasource.prototype.getAzureLogAnalyticsWorkspaces = function () {
        return this.azureLogAnalyticsDatasource.getWorkspaces();
    };
    return Datasource;
}());
export default Datasource;
//# sourceMappingURL=datasource.js.map