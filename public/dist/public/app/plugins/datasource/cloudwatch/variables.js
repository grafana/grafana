import { __awaiter } from "tslib";
import { from } from 'rxjs';
import { map } from 'rxjs/operators';
import { CustomVariableSupport, } from '@grafana/data';
import { VariableQueryEditor } from './components/VariableQueryEditor/VariableQueryEditor';
import { ALL_ACCOUNTS_OPTION } from './components/shared/Account';
import { DEFAULT_VARIABLE_QUERY } from './defaultQueries';
import { migrateVariableQuery } from './migrations/variableQueryMigrations';
import { standardStatistics } from './standardStatistics';
import { VariableQueryType } from './types';
export class CloudWatchVariableSupport extends CustomVariableSupport {
    constructor(resources) {
        super();
        this.resources = resources;
        this.editor = VariableQueryEditor;
        this.allMetricFindValue = { text: 'All', value: ALL_ACCOUNTS_OPTION.value, expandable: true };
    }
    query(request) {
        const queryObj = migrateVariableQuery(request.targets[0]);
        return from(this.execute(queryObj)).pipe(map((data) => ({ data })));
    }
    execute(query) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                switch (query.queryType) {
                    case VariableQueryType.Regions:
                        return this.handleRegionsQuery();
                    case VariableQueryType.Namespaces:
                        return this.handleNamespacesQuery();
                    case VariableQueryType.Metrics:
                        return this.handleMetricsQuery(query);
                    case VariableQueryType.DimensionKeys:
                        return this.handleDimensionKeysQuery(query);
                    case VariableQueryType.DimensionValues:
                        return this.handleDimensionValuesQuery(query);
                    case VariableQueryType.EBSVolumeIDs:
                        return this.handleEbsVolumeIdsQuery(query);
                    case VariableQueryType.EC2InstanceAttributes:
                        return this.handleEc2InstanceAttributeQuery(query);
                    case VariableQueryType.ResourceArns:
                        return this.handleResourceARNsQuery(query);
                    case VariableQueryType.Statistics:
                        return this.handleStatisticsQuery();
                    case VariableQueryType.LogGroups:
                        return this.handleLogGroupsQuery(query);
                    case VariableQueryType.Accounts:
                        return this.handleAccountsQuery(query);
                }
            }
            catch (error) {
                console.error(`Could not run CloudWatchMetricFindQuery ${query}`, error);
                return [];
            }
        });
    }
    handleLogGroupsQuery({ region, logGroupPrefix, accountId }) {
        return __awaiter(this, void 0, void 0, function* () {
            const interpolatedPrefix = this.resources.templateSrv.replace(logGroupPrefix);
            return this.resources
                .getLogGroups({
                accountId,
                region,
                logGroupNamePrefix: interpolatedPrefix,
                listAllLogGroups: true,
            })
                .then((logGroups) => logGroups.map((lg) => {
                return {
                    text: lg.value.name,
                    value: lg.value.arn,
                    expandable: true,
                };
            }));
        });
    }
    handleRegionsQuery() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.resources.getRegions().then((regions) => regions.map(selectableValueToMetricFindOption));
        });
    }
    handleNamespacesQuery() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.resources.getNamespaces().then((namespaces) => namespaces.map(selectableValueToMetricFindOption));
        });
    }
    handleMetricsQuery({ namespace, region, accountId }) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.resources
                .getMetrics({ namespace, region, accountId })
                .then((metrics) => metrics.map(selectableValueToMetricFindOption));
        });
    }
    handleDimensionKeysQuery({ namespace, region, accountId }) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.resources
                .getDimensionKeys({ namespace, region, accountId })
                .then((keys) => keys.map(selectableValueToMetricFindOption));
        });
    }
    handleDimensionValuesQuery({ namespace, accountId, region, dimensionKey, metricName, dimensionFilters, }) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!dimensionKey || !metricName) {
                return [];
            }
            return this.resources
                .getDimensionValues({
                region,
                accountId,
                namespace,
                metricName,
                dimensionKey,
                dimensionFilters,
            })
                .then((values) => values.map(selectableValueToMetricFindOption));
        });
    }
    handleEbsVolumeIdsQuery({ region, instanceID }) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!instanceID) {
                return [];
            }
            return this.resources.getEbsVolumeIds(region, instanceID).then((ids) => ids.map(selectableValueToMetricFindOption));
        });
    }
    handleEc2InstanceAttributeQuery({ region, attributeName, ec2Filters }) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!attributeName) {
                return [];
            }
            return this.resources
                .getEc2InstanceAttribute(region, attributeName, ec2Filters !== null && ec2Filters !== void 0 ? ec2Filters : {})
                .then((values) => values.map(selectableValueToMetricFindOption));
        });
    }
    handleResourceARNsQuery({ region, resourceType, tags }) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!resourceType) {
                return [];
            }
            const keys = yield this.resources.getResourceARNs(region, resourceType, tags !== null && tags !== void 0 ? tags : {});
            return keys.map(selectableValueToMetricFindOption);
        });
    }
    handleStatisticsQuery() {
        return __awaiter(this, void 0, void 0, function* () {
            return standardStatistics.map((s) => ({
                text: s,
                value: s,
                expandable: true,
            }));
        });
    }
    handleAccountsQuery({ region }) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.resources.getAccounts({ region }).then((accounts) => {
                const metricFindOptions = accounts.map((account) => ({
                    text: account.label,
                    value: account.id,
                    expandable: true,
                }));
                return metricFindOptions.length ? [this.allMetricFindValue, ...metricFindOptions] : [];
            });
        });
    }
    getDefaultQuery() {
        return DEFAULT_VARIABLE_QUERY;
    }
}
function selectableValueToMetricFindOption({ label, value }) {
    var _a;
    return { text: (_a = label !== null && label !== void 0 ? label : value) !== null && _a !== void 0 ? _a : '', value: value, expandable: true };
}
//# sourceMappingURL=variables.js.map