import { setKustoQuery } from '../components/LogsQueryEditor/setQueryValue';
import { appendDimensionFilter, setTimeGrain as setMetricsTimeGrain, } from '../components/MetricsQueryEditor/setQueryValue';
import { parseResourceDetails } from '../components/ResourcePicker/utils';
import TimegrainConverter from '../time_grain_converter';
import { AzureQueryType } from '../types';
const OLD_DEFAULT_DROPDOWN_VALUE = 'select';
export default function migrateQuery(query) {
    var _a, _b, _c, _d;
    let workingQuery = query;
    if (!workingQuery.queryType) {
        workingQuery = Object.assign(Object.assign({}, workingQuery), { queryType: AzureQueryType.AzureMonitor });
    }
    workingQuery = migrateLogAnalyticsToFromTimes(workingQuery);
    if (workingQuery.queryType === AzureQueryType.AzureMonitor && workingQuery.azureMonitor) {
        workingQuery = migrateTimeGrains(workingQuery);
        workingQuery = migrateToDefaultNamespace(workingQuery);
        workingQuery = migrateDimensionToDimensionFilter(workingQuery);
        workingQuery = migrateDimensionFilterToArray(workingQuery);
        workingQuery = migrateResourceUriToResourceObj(workingQuery);
    }
    if (((_a = workingQuery.azureMonitor) === null || _a === void 0 ? void 0 : _a.resourceGroup) || ((_b = workingQuery.azureMonitor) === null || _b === void 0 ? void 0 : _b.resourceName)) {
        workingQuery = migrateResourceGroupAndName(workingQuery);
    }
    if ((_c = workingQuery.azureLogAnalytics) === null || _c === void 0 ? void 0 : _c.resource) {
        workingQuery = Object.assign(Object.assign({}, workingQuery), { azureLogAnalytics: Object.assign(Object.assign({}, workingQuery.azureLogAnalytics), { resources: [workingQuery.azureLogAnalytics.resource] }) });
        (_d = workingQuery.azureLogAnalytics) === null || _d === void 0 ? true : delete _d.resource;
    }
    if (workingQuery.azureLogAnalytics && workingQuery.azureLogAnalytics.dashboardTime === undefined) {
        if (workingQuery.azureLogAnalytics.intersectTime) {
            workingQuery = Object.assign(Object.assign({}, workingQuery), { azureLogAnalytics: Object.assign(Object.assign({}, workingQuery.azureLogAnalytics), { dashboardTime: true }) });
        }
        else {
            workingQuery = Object.assign(Object.assign({}, workingQuery), { azureLogAnalytics: Object.assign(Object.assign({}, workingQuery.azureLogAnalytics), { dashboardTime: false }) });
        }
    }
    return workingQuery;
}
function migrateTimeGrains(query) {
    var _a, _b, _c;
    let workingQuery = query;
    if (((_a = workingQuery.azureMonitor) === null || _a === void 0 ? void 0 : _a.timeGrainUnit) && workingQuery.azureMonitor.timeGrain !== 'auto') {
        const newTimeGrain = TimegrainConverter.createISO8601Duration((_b = workingQuery.azureMonitor.timeGrain) !== null && _b !== void 0 ? _b : 'auto', workingQuery.azureMonitor.timeGrainUnit);
        workingQuery = setMetricsTimeGrain(workingQuery, newTimeGrain);
        (_c = workingQuery.azureMonitor) === null || _c === void 0 ? true : delete _c.timeGrainUnit;
    }
    return workingQuery;
}
function migrateLogAnalyticsToFromTimes(query) {
    var _a, _b, _c, _d;
    let workingQuery = query;
    if ((_b = (_a = workingQuery.azureLogAnalytics) === null || _a === void 0 ? void 0 : _a.query) === null || _b === void 0 ? void 0 : _b.match(/\$__from\s/gi)) {
        workingQuery = setKustoQuery(workingQuery, workingQuery.azureLogAnalytics.query.replace(/\$__from\s/gi, '$__timeFrom() '));
    }
    if ((_d = (_c = workingQuery.azureLogAnalytics) === null || _c === void 0 ? void 0 : _c.query) === null || _d === void 0 ? void 0 : _d.match(/\$__to\s/gi)) {
        workingQuery = setKustoQuery(workingQuery, workingQuery.azureLogAnalytics.query.replace(/\$__to\s/gi, '$__timeTo() '));
    }
    return workingQuery;
}
function migrateToDefaultNamespace(query) {
    var _a, _b;
    const haveMetricNamespace = ((_a = query.azureMonitor) === null || _a === void 0 ? void 0 : _a.metricNamespace) && query.azureMonitor.metricNamespace !== OLD_DEFAULT_DROPDOWN_VALUE;
    if (!haveMetricNamespace && ((_b = query.azureMonitor) === null || _b === void 0 ? void 0 : _b.metricDefinition)) {
        return Object.assign(Object.assign({}, query), { azureMonitor: Object.assign(Object.assign({}, query.azureMonitor), { metricNamespace: query.azureMonitor.metricDefinition, metricDefinition: undefined }) });
    }
    return query;
}
function migrateDimensionToDimensionFilter(query) {
    var _a, _b, _c, _d;
    let workingQuery = query;
    const oldDimension = (_a = workingQuery.azureMonitor) === null || _a === void 0 ? void 0 : _a.dimension;
    if (oldDimension && oldDimension !== 'None') {
        workingQuery = appendDimensionFilter(workingQuery, oldDimension, 'eq', [
            ((_b = workingQuery.azureMonitor) === null || _b === void 0 ? void 0 : _b.dimensionFilter) || '',
        ]);
    }
    (_c = workingQuery.azureMonitor) === null || _c === void 0 ? true : delete _c.dimension;
    (_d = workingQuery.azureMonitor) === null || _d === void 0 ? true : delete _d.dimensionFilter;
    return workingQuery;
}
function migrateDimensionFilterToArray(query) {
    const azureMonitorQuery = query.azureMonitor;
    if (!azureMonitorQuery) {
        return query;
    }
    const newFilters = [];
    const dimensionFilters = azureMonitorQuery.dimensionFilters;
    if (dimensionFilters && dimensionFilters.length > 0) {
        dimensionFilters.forEach((filter) => {
            const staticProps = { dimension: filter.dimension, operator: filter.operator };
            if (!filter.filters && filter.filter) {
                newFilters.push(Object.assign(Object.assign({}, staticProps), { filters: [filter.filter] }));
            }
            else {
                let hasFilter = false;
                if (filter.filters && filter.filter) {
                    for (const oldFilter of filter.filters) {
                        if (filter.filter === oldFilter) {
                            hasFilter = true;
                            break;
                        }
                    }
                    if (!hasFilter && filter.filter !== '*') {
                        filter.filters.push(filter.filter);
                    }
                    newFilters.push(Object.assign(Object.assign({}, staticProps), { filters: filter.filters }));
                }
            }
        });
        if (newFilters.length > 0) {
            return Object.assign(Object.assign({}, query), { azureMonitor: Object.assign(Object.assign({}, azureMonitorQuery), { dimensionFilters: newFilters }) });
        }
    }
    return query;
}
function migrateResourceUriToResourceObj(query) {
    var _a;
    if (((_a = query.azureMonitor) === null || _a === void 0 ? void 0 : _a.resourceUri) && !query.azureMonitor.resourceUri.startsWith('$')) {
        const details = parseResourceDetails(query.azureMonitor.resourceUri);
        const isWellFormedUri = (details === null || details === void 0 ? void 0 : details.subscription) && (details === null || details === void 0 ? void 0 : details.resourceGroup) && (details === null || details === void 0 ? void 0 : details.resourceName);
        return Object.assign(Object.assign({}, query), { subscription: details === null || details === void 0 ? void 0 : details.subscription, azureMonitor: Object.assign(Object.assign({}, query.azureMonitor), { resources: [{ resourceGroup: details === null || details === void 0 ? void 0 : details.resourceGroup, resourceName: details === null || details === void 0 ? void 0 : details.resourceName }], metricNamespace: details === null || details === void 0 ? void 0 : details.metricNamespace, resourceUri: isWellFormedUri ? undefined : query.azureMonitor.resourceUri }) });
    }
    return query;
}
function migrateResourceGroupAndName(query) {
    var _a, _b, _c, _d;
    let workingQuery = query;
    if (((_a = workingQuery.azureMonitor) === null || _a === void 0 ? void 0 : _a.resourceGroup) && ((_b = workingQuery.azureMonitor) === null || _b === void 0 ? void 0 : _b.resourceName)) {
        workingQuery = Object.assign(Object.assign({}, workingQuery), { azureMonitor: Object.assign(Object.assign({}, workingQuery.azureMonitor), { resources: [
                    {
                        resourceGroup: workingQuery.azureMonitor.resourceGroup,
                        resourceName: workingQuery.azureMonitor.resourceName,
                    },
                ] }) });
        (_c = workingQuery.azureMonitor) === null || _c === void 0 ? true : delete _c.resourceGroup;
        (_d = workingQuery.azureMonitor) === null || _d === void 0 ? true : delete _d.resourceName;
    }
    return workingQuery;
}
//# sourceMappingURL=migrateQuery.js.map