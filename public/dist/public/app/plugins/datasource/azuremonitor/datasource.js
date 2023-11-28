import { cloneDeep } from 'lodash';
import { forkJoin, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { LoadingState, } from '@grafana/data';
import { DataSourceWithBackend, getTemplateSrv } from '@grafana/runtime';
import AzureLogAnalyticsDatasource from './azure_log_analytics/azure_log_analytics_datasource';
import AzureMonitorDatasource from './azure_monitor/azure_monitor_datasource';
import AzureResourceGraphDatasource from './azure_resource_graph/azure_resource_graph_datasource';
import ResourcePickerData from './resourcePicker/resourcePickerData';
import { AzureQueryType } from './types';
import migrateAnnotation from './utils/migrateAnnotation';
import migrateQuery from './utils/migrateQuery';
import { VariableSupport } from './variables';
export default class Datasource extends DataSourceWithBackend {
    constructor(instanceSettings, templateSrv = getTemplateSrv()) {
        super(instanceSettings);
        this.templateSrv = templateSrv;
        this.annotations = {
            prepareAnnotation: migrateAnnotation,
        };
        this.pseudoDatasource = {};
        this.azureMonitorDatasource = new AzureMonitorDatasource(instanceSettings);
        this.azureLogAnalyticsDatasource = new AzureLogAnalyticsDatasource(instanceSettings);
        this.azureResourceGraphDatasource = new AzureResourceGraphDatasource(instanceSettings);
        this.resourcePickerData = new ResourcePickerData(instanceSettings, this.azureMonitorDatasource);
        this.pseudoDatasource = {
            [AzureQueryType.AzureMonitor]: this.azureMonitorDatasource,
            [AzureQueryType.LogAnalytics]: this.azureLogAnalyticsDatasource,
            [AzureQueryType.AzureResourceGraph]: this.azureResourceGraphDatasource,
        };
        this.variables = new VariableSupport(this);
    }
    filterQuery(item) {
        var _a, _b;
        if (!item.queryType) {
            return false;
        }
        const ds = this.pseudoDatasource[item.queryType];
        return (_b = (_a = ds === null || ds === void 0 ? void 0 : ds.filterQuery) === null || _a === void 0 ? void 0 : _a.call(ds, item)) !== null && _b !== void 0 ? _b : true;
    }
    query(options) {
        const byType = new Map();
        for (const baseTarget of options.targets) {
            // Migrate old query structures
            const target = migrateQuery(baseTarget);
            // Skip hidden or invalid queries or ones without properties
            if (!target.queryType || target.hide || !hasQueryForType(target)) {
                continue;
            }
            // Initialize the list of queries
            if (!byType.has(target.queryType)) {
                const queryForType = cloneDeep(options);
                queryForType.requestId = `${queryForType.requestId}-${target.refId}`;
                queryForType.targets = [];
                byType.set(target.queryType, queryForType);
            }
            const queryForType = byType.get(target.queryType);
            queryForType === null || queryForType === void 0 ? void 0 : queryForType.targets.push(target);
        }
        const observables = Array.from(byType.entries()).map(([queryType, req]) => {
            const mappedQueryType = queryType === AzureQueryType.AzureTraces ? AzureQueryType.LogAnalytics : queryType;
            const ds = this.pseudoDatasource[mappedQueryType];
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
            return forkJoin(observables).pipe(map((results) => {
                const data = [];
                for (const result of results) {
                    for (const frame of result.data) {
                        data.push(frame);
                    }
                }
                return { state: LoadingState.Done, data };
            }));
        }
        return of({ state: LoadingState.Done, data: [] });
    }
    targetContainsTemplate(query) {
        if (query.subscription && this.templateSrv.containsTemplate(query.subscription)) {
            return true;
        }
        let subQuery;
        if (query.queryType === AzureQueryType.AzureMonitor) {
            subQuery = JSON.stringify(query.azureMonitor);
        }
        else if (query.queryType === AzureQueryType.LogAnalytics) {
            subQuery = JSON.stringify(query.azureLogAnalytics);
        }
        else if (query.queryType === AzureQueryType.AzureResourceGraph) {
            subQuery = JSON.stringify([query.azureResourceGraph, query.subscriptions]);
        }
        return !!subQuery && this.templateSrv.containsTemplate(subQuery);
    }
    /* Azure Monitor REST API methods */
    getResourceGroups(subscriptionId) {
        return this.azureMonitorDatasource.getResourceGroups(this.templateSrv.replace(subscriptionId));
    }
    getMetricNamespaces(subscriptionId, resourceGroup) {
        let url = `/subscriptions/${subscriptionId}`;
        if (resourceGroup) {
            url += `/resourceGroups/${resourceGroup};`;
        }
        return this.azureMonitorDatasource.getMetricNamespaces({ resourceUri: url }, true);
    }
    getResourceNames(subscriptionId, resourceGroup, metricNamespace, region) {
        return this.azureMonitorDatasource.getResourceNames({ subscriptionId, resourceGroup, metricNamespace, region });
    }
    getMetricNames(subscriptionId, resourceGroup, metricNamespace, resourceName) {
        return this.azureMonitorDatasource.getMetricNames({
            subscription: subscriptionId,
            resourceGroup,
            metricNamespace,
            resourceName,
        });
    }
    /*Azure Log Analytics */
    getAzureLogAnalyticsWorkspaces(subscriptionId) {
        return this.azureLogAnalyticsDatasource.getWorkspaces(subscriptionId);
    }
    getSubscriptions() {
        return this.azureMonitorDatasource.getSubscriptions();
    }
    interpolateVariablesInQueries(queries, scopedVars) {
        const mapped = queries.map((query) => {
            var _a;
            if (!query.queryType) {
                return query;
            }
            const queryType = query.queryType === AzureQueryType.AzureTraces ? AzureQueryType.LogAnalytics : query.queryType;
            const ds = this.pseudoDatasource[queryType];
            return Object.assign({ datasource: ds === null || ds === void 0 ? void 0 : ds.getRef() }, ((_a = ds === null || ds === void 0 ? void 0 : ds.applyTemplateVariables(query, scopedVars)) !== null && _a !== void 0 ? _a : query));
        });
        return mapped;
    }
    getVariables() {
        return this.templateSrv.getVariables().map((v) => `$${v.name}`);
    }
    getVariablesRaw() {
        return this.templateSrv.getVariables();
    }
}
function hasQueryForType(query) {
    switch (query.queryType) {
        case AzureQueryType.AzureMonitor:
            return !!query.azureMonitor;
        case AzureQueryType.LogAnalytics:
            return !!query.azureLogAnalytics;
        case AzureQueryType.AzureResourceGraph:
            return !!query.azureResourceGraph;
        case AzureQueryType.AzureTraces:
            return !!query.azureTraces;
        case AzureQueryType.GrafanaTemplateVariableFn:
            return !!query.grafanaTemplateVariableFn;
        default:
            return false;
    }
}
//# sourceMappingURL=datasource.js.map