import { __awaiter } from "tslib";
import { map } from 'lodash';
import { DataSourceWithBackend, getTemplateSrv } from '@grafana/runtime';
import ResponseParser from '../azure_monitor/response_parser';
import { getAuthType, getAzureCloud, getAzurePortalUrl } from '../credentials';
import { AzureQueryType, } from '../types';
import { interpolateVariable, routeNames } from '../utils/common';
import { transformMetadataToKustoSchema } from './utils';
export default class AzureLogAnalyticsDatasource extends DataSourceWithBackend {
    constructor(instanceSettings, templateSrv = getTemplateSrv()) {
        super(instanceSettings);
        this.instanceSettings = instanceSettings;
        this.templateSrv = templateSrv;
        this.resourcePath = `${routeNames.logAnalytics}`;
        this.azureMonitorPath = `${routeNames.azureMonitor}/subscriptions`;
        const cloud = getAzureCloud(instanceSettings);
        this.azurePortalUrl = getAzurePortalUrl(cloud);
        this.defaultSubscriptionId = this.instanceSettings.jsonData.subscriptionId || '';
    }
    isConfigured() {
        // If validation didn't return any error then the data source is properly configured
        return !this.validateDatasource();
    }
    filterQuery(item) {
        var _a, _b, _c, _d;
        return (item.hide !== true &&
            ((!!((_a = item.azureLogAnalytics) === null || _a === void 0 ? void 0 : _a.query) &&
                (!!((_b = item.azureLogAnalytics.resources) === null || _b === void 0 ? void 0 : _b.length) || !!item.azureLogAnalytics.workspace)) ||
                !!((_d = (_c = item.azureTraces) === null || _c === void 0 ? void 0 : _c.resources) === null || _d === void 0 ? void 0 : _d.length)));
    }
    getSubscriptions() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isConfigured()) {
                return [];
            }
            const path = `${this.azureMonitorPath}?api-version=2019-03-01`;
            return yield this.getResource(path).then((result) => {
                return ResponseParser.parseSubscriptions(result);
            });
        });
    }
    getWorkspaces(subscription) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.getWorkspaceList(subscription);
            return (map(response.value, (val) => {
                return {
                    text: val.name,
                    value: val.id,
                };
            }) || []);
        });
    }
    getWorkspaceList(subscription) {
        const subscriptionId = this.templateSrv.replace(subscription || this.defaultSubscriptionId);
        const workspaceListUrl = this.azureMonitorPath +
            `/${subscriptionId}/providers/Microsoft.OperationalInsights/workspaces?api-version=2017-04-26-preview`;
        return this.getResource(workspaceListUrl);
    }
    getMetadata(resourceUri) {
        return __awaiter(this, void 0, void 0, function* () {
            const path = `${this.resourcePath}/v1${resourceUri}/metadata`;
            const resp = yield this.getResource(path);
            return resp;
        });
    }
    getKustoSchema(resourceUri) {
        return __awaiter(this, void 0, void 0, function* () {
            const interpolatedUri = this.templateSrv.replace(resourceUri, {}, interpolateVariable);
            const metadata = yield this.getMetadata(interpolatedUri);
            return transformMetadataToKustoSchema(metadata, interpolatedUri, this.templateSrv.getVariables());
        });
    }
    applyTemplateVariables(target, scopedVars) {
        var _a, _b, _c;
        let item;
        if (target.queryType === AzureQueryType.LogAnalytics && target.azureLogAnalytics) {
            item = target.azureLogAnalytics;
            const resources = this.expandResourcesForMultipleVariables(item.resources, scopedVars);
            let workspace = this.templateSrv.replace(item.workspace, scopedVars);
            if (!workspace && !resources && this.firstWorkspace) {
                workspace = this.firstWorkspace;
            }
            const query = this.templateSrv.replace(item.query, scopedVars, interpolateVariable);
            return Object.assign(Object.assign({}, target), { queryType: target.queryType || AzureQueryType.LogAnalytics, azureLogAnalytics: {
                    resultFormat: item.resultFormat,
                    query,
                    resources,
                    // Workspace was removed in Grafana 8, but remains for backwards compat
                    workspace,
                    dashboardTime: item.dashboardTime,
                    timeColumn: this.templateSrv.replace(item.timeColumn, scopedVars),
                } });
        }
        if (target.queryType === AzureQueryType.AzureTraces && target.azureTraces) {
            item = target.azureTraces;
            const resources = this.expandResourcesForMultipleVariables(item.resources, scopedVars);
            const query = this.templateSrv.replace(item.query, scopedVars, interpolateVariable);
            const traceTypes = (_a = item.traceTypes) === null || _a === void 0 ? void 0 : _a.map((t) => this.templateSrv.replace(t, scopedVars));
            const filters = ((_b = item.filters) !== null && _b !== void 0 ? _b : [])
                .filter((f) => !!f.property)
                .map((f) => {
                var _a;
                const filtersReplaced = (_a = f.filters) === null || _a === void 0 ? void 0 : _a.map((filter) => this.templateSrv.replace(filter !== null && filter !== void 0 ? filter : '', scopedVars));
                return {
                    property: this.templateSrv.replace(f.property, scopedVars),
                    operation: f.operation || 'eq',
                    filters: filtersReplaced || [],
                };
            });
            return Object.assign(Object.assign({}, target), { queryType: target.queryType || AzureQueryType.AzureTraces, azureTraces: {
                    resultFormat: item.resultFormat,
                    query,
                    resources,
                    operationId: this.templateSrv.replace((_c = target.azureTraces) === null || _c === void 0 ? void 0 : _c.operationId, scopedVars),
                    filters,
                    traceTypes,
                } });
        }
        return target;
    }
    expandResourcesForMultipleVariables(resources, scopedVars) {
        if (!resources) {
            return undefined;
        }
        const expandedResources = [];
        resources.forEach((r) => {
            const tempVars = this.templateSrv.replace(r, scopedVars, 'raw');
            const values = tempVars.split(',');
            values.forEach((value) => {
                expandedResources.push(value);
            });
        });
        return expandedResources;
    }
    /*
      In 7.5.x it used to be possible to set a default workspace id in the config on the auth page.
      This has been deprecated, however is still used by a few legacy template queries.
    */
    getDeprecatedDefaultWorkSpace() {
        return this.instanceSettings.jsonData.logAnalyticsDefaultWorkspace;
    }
    getDefaultOrFirstSubscription() {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            if (this.defaultSubscriptionId) {
                return this.defaultSubscriptionId;
            }
            const subscriptions = yield this.getSubscriptions();
            return (_a = subscriptions[0]) === null || _a === void 0 ? void 0 : _a.value;
        });
    }
    getFirstWorkspace() {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            if (this.firstWorkspace) {
                return this.firstWorkspace;
            }
            const subscriptionId = yield this.getDefaultOrFirstSubscription();
            if (!subscriptionId) {
                return undefined;
            }
            const workspaces = yield this.getWorkspaces(subscriptionId);
            const workspace = (_a = workspaces[0]) === null || _a === void 0 ? void 0 : _a.value;
            if (workspace) {
                this.firstWorkspace = workspace;
            }
            return workspace;
        });
    }
    validateDatasource() {
        const authType = getAuthType(this.instanceSettings);
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
    }
    isValidConfigField(field) {
        return typeof field === 'string' && field.length > 0;
    }
    getAzureLogAnalyticsCheatsheetQueries() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.getResource(`${this.resourcePath}/v1/metadata`);
        });
    }
}
//# sourceMappingURL=azure_log_analytics_datasource.js.map