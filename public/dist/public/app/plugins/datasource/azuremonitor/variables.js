import { __awaiter } from "tslib";
import { from, lastValueFrom } from 'rxjs';
import { CustomVariableSupport, toDataFrame, } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import VariableEditor from './components/VariableEditor/VariableEditor';
import { migrateQuery } from './grafanaTemplateVariableFns';
import { AzureQueryType } from './types';
import messageFromError from './utils/messageFromError';
export class VariableSupport extends CustomVariableSupport {
    constructor(datasource, templateSrv = getTemplateSrv()) {
        super();
        this.datasource = datasource;
        this.templateSrv = templateSrv;
        this.editor = VariableEditor;
        this.datasource = datasource;
    }
    hasValue(...values) {
        return values.every((v) => !!this.templateSrv.replace(v));
    }
    query(request) {
        const promisedResults = () => __awaiter(this, void 0, void 0, function* () {
            const queryObj = yield migrateQuery(request.targets[0], { datasource: this.datasource });
            try {
                switch (queryObj.queryType) {
                    case AzureQueryType.SubscriptionsQuery:
                        const res = yield this.datasource.getSubscriptions();
                        return {
                            data: (res === null || res === void 0 ? void 0 : res.length) ? [toDataFrame(res)] : [],
                        };
                    case AzureQueryType.ResourceGroupsQuery:
                        if (queryObj.subscription && this.hasValue(queryObj.subscription)) {
                            const rgs = yield this.datasource.getResourceGroups(queryObj.subscription);
                            return {
                                data: (rgs === null || rgs === void 0 ? void 0 : rgs.length) ? [toDataFrame(rgs)] : [],
                            };
                        }
                        return { data: [] };
                    case AzureQueryType.NamespacesQuery:
                        if (queryObj.subscription && this.hasValue(queryObj.subscription)) {
                            const rgs = yield this.datasource.getMetricNamespaces(queryObj.subscription, queryObj.resourceGroup);
                            return {
                                data: (rgs === null || rgs === void 0 ? void 0 : rgs.length) ? [toDataFrame(rgs)] : [],
                            };
                        }
                        return { data: [] };
                    case AzureQueryType.ResourceNamesQuery:
                        if (queryObj.subscription && this.hasValue(queryObj.subscription)) {
                            const rgs = yield this.datasource.getResourceNames(queryObj.subscription, queryObj.resourceGroup, queryObj.namespace, queryObj.region);
                            return {
                                data: (rgs === null || rgs === void 0 ? void 0 : rgs.length) ? [toDataFrame(rgs)] : [],
                            };
                        }
                        return { data: [] };
                    case AzureQueryType.MetricNamesQuery:
                        if (queryObj.subscription &&
                            queryObj.resourceGroup &&
                            queryObj.namespace &&
                            queryObj.resource &&
                            this.hasValue(queryObj.subscription, queryObj.resourceGroup, queryObj.namespace, queryObj.resource)) {
                            const rgs = yield this.datasource.getMetricNames(queryObj.subscription, queryObj.resourceGroup, queryObj.namespace, queryObj.resource);
                            return {
                                data: (rgs === null || rgs === void 0 ? void 0 : rgs.length) ? [toDataFrame(rgs)] : [],
                            };
                        }
                        return { data: [] };
                    case AzureQueryType.WorkspacesQuery:
                        if (queryObj.subscription && this.hasValue(queryObj.subscription)) {
                            const rgs = yield this.datasource.getAzureLogAnalyticsWorkspaces(queryObj.subscription);
                            return {
                                data: (rgs === null || rgs === void 0 ? void 0 : rgs.length) ? [toDataFrame(rgs)] : [],
                            };
                        }
                        return { data: [] };
                    case AzureQueryType.GrafanaTemplateVariableFn:
                        if (queryObj.grafanaTemplateVariableFn) {
                            const templateVariablesResults = yield this.callGrafanaTemplateVariableFn(queryObj.grafanaTemplateVariableFn);
                            return {
                                data: (templateVariablesResults === null || templateVariablesResults === void 0 ? void 0 : templateVariablesResults.length) ? [toDataFrame(templateVariablesResults)] : [],
                            };
                        }
                        return { data: [] };
                    case AzureQueryType.LocationsQuery:
                        if (queryObj.subscription && this.hasValue(queryObj.subscription)) {
                            const locationMap = yield this.datasource.azureMonitorDatasource.getLocations([queryObj.subscription]);
                            const res = [];
                            locationMap.forEach((loc) => {
                                res.push({ text: loc.displayName, value: loc.name });
                            });
                            return {
                                data: (res === null || res === void 0 ? void 0 : res.length) ? [toDataFrame(res)] : [],
                            };
                        }
                    default:
                        request.targets[0] = queryObj;
                        const queryResp = yield lastValueFrom(this.datasource.query(request));
                        return {
                            data: queryResp.data,
                            error: queryResp.error ? new Error(messageFromError(queryResp.error)) : undefined,
                        };
                }
            }
            catch (err) {
                return { data: [], error: new Error(messageFromError(err)) };
            }
        });
        return from(promisedResults());
    }
    // Deprecated
    callGrafanaTemplateVariableFn(query) {
        if (query.kind === 'SubscriptionsQuery') {
            return this.datasource.getSubscriptions();
        }
        if (query.kind === 'ResourceGroupsQuery') {
            return this.datasource.getResourceGroups(this.replaceVariable(query.subscription));
        }
        if (query.kind === 'ResourceNamesQuery') {
            return this.datasource.getResourceNames(this.replaceVariable(query.subscription), this.replaceVariable(query.resourceGroup), this.replaceVariable(query.metricNamespace));
        }
        if (query.kind === 'MetricNamespaceQuery') {
            return this.datasource.azureMonitorDatasource.getMetricNamespaces(query, true);
        }
        if (query.kind === 'MetricNamesQuery') {
            return this.datasource.azureMonitorDatasource.getMetricNames(query);
        }
        if (query.kind === 'WorkspacesQuery') {
            return this.datasource.azureLogAnalyticsDatasource.getWorkspaces(this.replaceVariable(query.subscription));
        }
        return null;
    }
    replaceVariable(metric) {
        return this.templateSrv.replace((metric || '').trim());
    }
}
//# sourceMappingURL=variables.js.map