import { __awaiter } from "tslib";
import { find, startsWith } from 'lodash';
import { DataSourceWithBackend, getTemplateSrv } from '@grafana/runtime';
import { getAuthType, getAzureCloud, getAzurePortalUrl } from '../credentials';
import TimegrainConverter from '../time_grain_converter';
import { AzureQueryType, } from '../types';
import { routeNames } from '../utils/common';
import migrateQuery from '../utils/migrateQuery';
import ResponseParser from './response_parser';
import UrlBuilder from './url_builder';
const defaultDropdownValue = 'select';
function hasValue(item) {
    return !!(item && item !== defaultDropdownValue);
}
export default class AzureMonitorDatasource extends DataSourceWithBackend {
    constructor(instanceSettings, templateSrv = getTemplateSrv()) {
        super(instanceSettings);
        this.instanceSettings = instanceSettings;
        this.templateSrv = templateSrv;
        this.apiVersion = '2018-01-01';
        this.apiPreviewVersion = '2017-12-01-preview';
        this.listByResourceGroupApiVersion = '2021-04-01';
        this.providerApiVersion = '2021-04-01';
        this.locationsApiVersion = '2020-01-01';
        this.defaultSubscriptionId = instanceSettings.jsonData.subscriptionId;
        const cloud = getAzureCloud(instanceSettings);
        this.resourcePath = routeNames.azureMonitor;
        this.azurePortalUrl = getAzurePortalUrl(cloud);
    }
    isConfigured() {
        // If validation didn't return any error then the data source is properly configured
        return !this.validateDatasource();
    }
    filterQuery(item) {
        var _a, _b, _c, _d, _e, _f;
        const hasResource = ((_a = item === null || item === void 0 ? void 0 : item.azureMonitor) === null || _a === void 0 ? void 0 : _a.resources) &&
            item.azureMonitor.resources.length > 0 &&
            item.azureMonitor.resources.every((r) => hasValue(r.resourceGroup) && hasValue(r.resourceName)) &&
            hasValue(((_b = item === null || item === void 0 ? void 0 : item.azureMonitor) === null || _b === void 0 ? void 0 : _b.metricDefinition) || ((_c = item === null || item === void 0 ? void 0 : item.azureMonitor) === null || _c === void 0 ? void 0 : _c.metricNamespace));
        const hasResourceUri = hasValue((_d = item.azureMonitor) === null || _d === void 0 ? void 0 : _d.resourceUri);
        return !!(item.hide !== true &&
            (hasResource || hasResourceUri) &&
            hasValue((_e = item === null || item === void 0 ? void 0 : item.azureMonitor) === null || _e === void 0 ? void 0 : _e.metricName) &&
            hasValue((_f = item === null || item === void 0 ? void 0 : item.azureMonitor) === null || _f === void 0 ? void 0 : _f.aggregation));
    }
    applyTemplateVariables(target, scopedVars) {
        var _a, _b;
        const preMigrationQuery = target.azureMonitor;
        if (!preMigrationQuery) {
            throw new Error('Query is not a valid Azure Monitor Metrics query');
        }
        // These properties need to be replaced pre-migration to ensure values are correctly interpolated
        if (preMigrationQuery.resourceUri) {
            preMigrationQuery.resourceUri = this.templateSrv.replace(preMigrationQuery.resourceUri, scopedVars);
        }
        if (preMigrationQuery.metricDefinition) {
            preMigrationQuery.metricDefinition = this.templateSrv.replace(preMigrationQuery.metricDefinition, scopedVars);
        }
        // fix for timeGrainUnit which is a deprecated/removed field name
        if (preMigrationQuery.timeGrain && preMigrationQuery.timeGrainUnit && preMigrationQuery.timeGrain !== 'auto') {
            preMigrationQuery.timeGrain = TimegrainConverter.createISO8601Duration(preMigrationQuery.timeGrain, preMigrationQuery.timeGrainUnit);
        }
        const migratedTarget = migrateQuery(target);
        const migratedQuery = migratedTarget.azureMonitor;
        // This should never be triggered because the above error would've been thrown
        if (!migratedQuery) {
            throw new Error('Query is not a valid Azure Monitor Metrics query');
        }
        const subscriptionId = this.templateSrv.replace(migratedTarget.subscription || this.defaultSubscriptionId, scopedVars);
        const resources = (_a = migratedQuery.resources) === null || _a === void 0 ? void 0 : _a.map((r) => this.replaceTemplateVariables(r, scopedVars)).flat();
        const metricNamespace = this.templateSrv.replace(migratedQuery.metricNamespace, scopedVars);
        const customNamespace = this.templateSrv.replace(migratedQuery.customNamespace, scopedVars);
        const timeGrain = this.templateSrv.replace((migratedQuery.timeGrain || '').toString(), scopedVars);
        const aggregation = this.templateSrv.replace(migratedQuery.aggregation, scopedVars);
        const top = this.templateSrv.replace(migratedQuery.top || '', scopedVars);
        const dimensionFilters = ((_b = migratedQuery.dimensionFilters) !== null && _b !== void 0 ? _b : [])
            .filter((f) => f.dimension && f.dimension !== 'None')
            .map((f) => {
            var _a;
            const filters = (_a = f.filters) === null || _a === void 0 ? void 0 : _a.map((filter) => this.templateSrv.replace(filter !== null && filter !== void 0 ? filter : '', scopedVars));
            return {
                dimension: this.templateSrv.replace(f.dimension, scopedVars),
                operator: f.operator || 'eq',
                filters: filters || [],
            };
        });
        const azMonitorQuery = Object.assign(Object.assign({}, migratedQuery), { resources,
            metricNamespace,
            customNamespace,
            timeGrain, allowedTimeGrainsMs: migratedQuery.allowedTimeGrainsMs, metricName: this.templateSrv.replace(migratedQuery.metricName, scopedVars), region: this.templateSrv.replace(migratedQuery.region, scopedVars), aggregation: aggregation, dimensionFilters, top: top || '10', alias: migratedQuery.alias });
        return Object.assign(Object.assign({}, target), { subscription: subscriptionId, queryType: AzureQueryType.AzureMonitor, azureMonitor: azMonitorQuery });
    }
    getSubscriptions() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isConfigured()) {
                return [];
            }
            return this.getResource(`${this.resourcePath}/subscriptions?api-version=2019-03-01`).then((result) => {
                return ResponseParser.parseSubscriptions(result);
            });
        });
    }
    getResourceGroups(subscriptionId) {
        return this.getResource(`${this.resourcePath}/subscriptions/${subscriptionId}/resourceGroups?api-version=${this.listByResourceGroupApiVersion}`).then((result) => {
            return ResponseParser.parseResponseValues(result, 'name', 'name');
        });
    }
    getResourceNames(query, skipToken) {
        return __awaiter(this, void 0, void 0, function* () {
            const promises = this.replaceTemplateVariables(query).map(({ metricNamespace, subscriptionId, resourceGroup, region }) => {
                const validMetricNamespace = startsWith(metricNamespace === null || metricNamespace === void 0 ? void 0 : metricNamespace.toLowerCase(), 'microsoft.storage/storageaccounts/')
                    ? 'microsoft.storage/storageaccounts'
                    : metricNamespace;
                let url = `${this.resourcePath}/subscriptions/${subscriptionId}`;
                if (resourceGroup) {
                    url += `/resourceGroups/${resourceGroup}`;
                }
                url += `/resources?api-version=${this.listByResourceGroupApiVersion}`;
                const filters = [];
                if (validMetricNamespace) {
                    filters.push(`resourceType eq '${validMetricNamespace}'`);
                }
                if (region) {
                    filters.push(`location eq '${region}'`);
                }
                if (filters.length > 0) {
                    url += `&$filter=${filters.join(' and ')}`;
                }
                if (skipToken) {
                    url += `&$skiptoken=${skipToken}`;
                }
                return this.getResource(url).then((result) => __awaiter(this, void 0, void 0, function* () {
                    let list = [];
                    if (startsWith(metricNamespace === null || metricNamespace === void 0 ? void 0 : metricNamespace.toLowerCase(), 'microsoft.storage/storageaccounts/')) {
                        list = ResponseParser.parseResourceNames(result, 'microsoft.storage/storageaccounts');
                        for (let i = 0; i < list.length; i++) {
                            list[i].text += '/default';
                            list[i].value += '/default';
                        }
                    }
                    else {
                        list = ResponseParser.parseResourceNames(result, metricNamespace);
                    }
                    if (result.nextLink) {
                        // If there is a nextLink, we should request more pages
                        const nextURL = new URL(result.nextLink);
                        const nextToken = nextURL.searchParams.get('$skiptoken');
                        if (!nextToken) {
                            throw Error('unable to request the next page of resources');
                        }
                        const nextPage = yield this.getResourceNames({ metricNamespace, subscriptionId, resourceGroup }, nextToken);
                        list = list.concat(nextPage);
                    }
                    return list;
                }));
            });
            return (yield Promise.all(promises)).flat();
        });
    }
    getMetricNamespaces(query, globalRegion) {
        const url = UrlBuilder.buildAzureMonitorGetMetricNamespacesUrl(this.resourcePath, this.apiPreviewVersion, 
        // Only use the first query, as the metric namespaces should be the same for all queries
        this.replaceSingleTemplateVariables(query), globalRegion, this.templateSrv);
        return this.getResource(url)
            .then((result) => {
            return ResponseParser.parseResponseValues(result, 'properties.metricNamespaceName', 'properties.metricNamespaceName');
        })
            .then((result) => {
            if (url.toLowerCase().includes('microsoft.storage/storageaccounts')) {
                const storageNamespaces = [
                    'microsoft.storage/storageaccounts',
                    'microsoft.storage/storageaccounts/blobservices',
                    'microsoft.storage/storageaccounts/fileservices',
                    'microsoft.storage/storageaccounts/tableservices',
                    'microsoft.storage/storageaccounts/queueservices',
                ];
                for (const namespace of storageNamespaces) {
                    if (!find(result, ['value', namespace.toLowerCase()])) {
                        result.push({ value: namespace, text: namespace });
                    }
                }
            }
            return result;
        });
    }
    getMetricNames(query, multipleResources, region) {
        const apiVersion = multipleResources ? this.apiPreviewVersion : this.apiVersion;
        const url = UrlBuilder.buildAzureMonitorGetMetricNamesUrl(this.resourcePath, apiVersion, 
        // Only use the first query, as the metric names should be the same for all queries
        this.replaceSingleTemplateVariables(query), this.templateSrv, multipleResources, region);
        return this.getResource(url).then((result) => {
            return ResponseParser.parseResponseValues(result, 'name.localizedValue', 'name.value');
        });
    }
    getMetricMetadata(query, multipleResources, region) {
        const { metricName } = query;
        const apiVersion = multipleResources ? this.apiPreviewVersion : this.apiVersion;
        const url = UrlBuilder.buildAzureMonitorGetMetricNamesUrl(this.resourcePath, apiVersion, 
        // Only use the first query, as the metric metadata should be the same for all queries
        this.replaceSingleTemplateVariables(query), this.templateSrv, multipleResources, region);
        return this.getResource(url).then((result) => {
            return ResponseParser.parseMetadata(result, this.templateSrv.replace(metricName));
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
    replaceSingleTemplateVariables(query, scopedVars) {
        // This method evaluates template variables supporting multiple values but only returns the first value.
        // This will work as far as the the first combination of variables is valid.
        // For example if 'rg1' contains 'res1' and 'rg2' contains 'res2' then
        // { resourceGroup: ['rg1', 'rg2'], resourceName: ['res1', 'res2'] } would return
        // { resourceGroup: 'rg1', resourceName: 'res1' } which is valid but
        // { resourceGroup: ['rg1', 'rg2'], resourceName: ['res2'] } would result in
        // { resourceGroup: 'rg1', resourceName: 'res2' } which is not.
        return this.replaceTemplateVariables(query, scopedVars)[0];
    }
    replaceTemplateVariables(query, scopedVars) {
        const workingQueries = [Object.assign({}, query)];
        const keys = Object.keys(query);
        keys.forEach((key) => {
            const replaced = this.templateSrv.replace(workingQueries[0][key], scopedVars, 'raw');
            if (replaced.includes(',')) {
                const multiple = replaced.split(',');
                const currentQueries = [...workingQueries];
                multiple.forEach((value, i) => {
                    currentQueries.forEach((q) => {
                        if (i === 0) {
                            q[key] = value;
                        }
                        else {
                            workingQueries.push(Object.assign(Object.assign({}, q), { [key]: value }));
                        }
                    });
                });
            }
            else {
                workingQueries.forEach((q) => {
                    q[key] = replaced;
                });
            }
        });
        return workingQueries;
    }
    getProvider(providerName) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.getResource(`${routeNames.azureMonitor}/providers/${providerName}?api-version=${this.providerApiVersion}`);
        });
    }
    getLocations(subscriptions) {
        return __awaiter(this, void 0, void 0, function* () {
            const locationMap = new Map();
            for (const subscription of subscriptions) {
                const subLocations = ResponseParser.parseLocations(yield this.getResource(`${routeNames.azureMonitor}/subscriptions/${this.templateSrv.replace(subscription)}/locations?api-version=${this.locationsApiVersion}`));
                for (const location of subLocations) {
                    locationMap.set(location.name, location);
                }
            }
            return locationMap;
        });
    }
}
//# sourceMappingURL=azure_monitor_datasource.js.map