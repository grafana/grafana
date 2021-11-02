import { __assign } from "tslib";
import { AzureQueryType } from '../types';
import TimegrainConverter from '../time_grain_converter';
import { appendDimensionFilter, setTimeGrain as setMetricsTimeGrain, } from '../components/MetricsQueryEditor/setQueryValue';
import { setKustoQuery } from '../components/LogsQueryEditor/setQueryValue';
var OLD_DEFAULT_DROPDOWN_VALUE = 'select';
export default function migrateQuery(query) {
    var workingQuery = query;
    // The old angular controller also had a `migrateApplicationInsightsKeys` migraiton that
    // migrated old properties to other properties that still do not appear to be used anymore, so
    // we decided to not include that migration anymore
    // See https://github.com/grafana/grafana/blob/a6a09add/public/app/plugins/datasource/grafana-azure-monitor-datasource/query_ctrl.ts#L269-L288
    workingQuery = migrateTimeGrains(workingQuery);
    workingQuery = migrateLogAnalyticsToFromTimes(workingQuery);
    workingQuery = migrateToDefaultNamespace(workingQuery);
    workingQuery = migrateApplicationInsightsDimensions(workingQuery);
    workingQuery = migrateMetricsDimensionFilters(workingQuery);
    return workingQuery;
}
function migrateTimeGrains(query) {
    var _a, _b, _c, _d;
    var workingQuery = query;
    if (((_a = workingQuery.azureMonitor) === null || _a === void 0 ? void 0 : _a.timeGrainUnit) && workingQuery.azureMonitor.timeGrain !== 'auto') {
        var newTimeGrain = TimegrainConverter.createISO8601Duration((_b = workingQuery.azureMonitor.timeGrain) !== null && _b !== void 0 ? _b : 'auto', workingQuery.azureMonitor.timeGrainUnit);
        workingQuery = setMetricsTimeGrain(workingQuery, newTimeGrain);
        (_c = workingQuery.azureMonitor) === null || _c === void 0 ? true : delete _c.timeGrainUnit;
    }
    if (((_d = workingQuery.appInsights) === null || _d === void 0 ? void 0 : _d.timeGrainUnit) && workingQuery.appInsights.timeGrain !== 'auto') {
        var appInsights = __assign({}, workingQuery.appInsights);
        if (workingQuery.appInsights.timeGrainCount) {
            appInsights.timeGrain = TimegrainConverter.createISO8601Duration(workingQuery.appInsights.timeGrainCount, workingQuery.appInsights.timeGrainUnit);
        }
        else {
            appInsights.timeGrainCount = workingQuery.appInsights.timeGrain;
            if (workingQuery.appInsights.timeGrain) {
                appInsights.timeGrain = TimegrainConverter.createISO8601Duration(workingQuery.appInsights.timeGrain, workingQuery.appInsights.timeGrainUnit);
            }
        }
        workingQuery = __assign(__assign({}, workingQuery), { appInsights: appInsights });
    }
    return workingQuery;
}
function migrateLogAnalyticsToFromTimes(query) {
    var _a, _b, _c, _d;
    var workingQuery = query;
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
    var haveMetricNamespace = ((_a = query.azureMonitor) === null || _a === void 0 ? void 0 : _a.metricNamespace) && query.azureMonitor.metricNamespace !== OLD_DEFAULT_DROPDOWN_VALUE;
    if (!haveMetricNamespace && ((_b = query.azureMonitor) === null || _b === void 0 ? void 0 : _b.metricDefinition)) {
        return __assign(__assign({}, query), { azureMonitor: __assign(__assign({}, query.azureMonitor), { metricNamespace: query.azureMonitor.metricDefinition }) });
    }
    return query;
}
function migrateApplicationInsightsDimensions(query) {
    var _a;
    var dimension = (_a = query === null || query === void 0 ? void 0 : query.appInsights) === null || _a === void 0 ? void 0 : _a.dimension;
    if (dimension && typeof dimension === 'string') {
        return __assign(__assign({}, query), { appInsights: __assign(__assign({}, query.appInsights), { dimension: [dimension] }) });
    }
    return query;
}
// Exported because its also used directly in the datasource.ts for some reason
function migrateMetricsDimensionFilters(query) {
    var _a, _b;
    var workingQuery = query;
    var oldDimension = (_a = workingQuery.azureMonitor) === null || _a === void 0 ? void 0 : _a.dimension;
    if (oldDimension && oldDimension !== 'None') {
        workingQuery = appendDimensionFilter(workingQuery, oldDimension, 'eq', (_b = workingQuery.azureMonitor) === null || _b === void 0 ? void 0 : _b.dimensionFilter);
    }
    return workingQuery;
}
// datasource.ts also contains some migrations, which have been moved to here. Unsure whether
// they should also do all the other migrations...
export function datasourceMigrations(query) {
    var _a;
    var workingQuery = query;
    if (workingQuery.queryType === AzureQueryType.ApplicationInsights && ((_a = workingQuery.appInsights) === null || _a === void 0 ? void 0 : _a.rawQuery)) {
        workingQuery = __assign(__assign({}, workingQuery), { queryType: AzureQueryType.InsightsAnalytics, appInsights: undefined, insightsAnalytics: {
                query: workingQuery.appInsights.rawQuery,
                resultFormat: 'time_series',
            } });
    }
    if (!workingQuery.queryType) {
        workingQuery = __assign(__assign({}, workingQuery), { queryType: AzureQueryType.AzureMonitor });
    }
    if (workingQuery.queryType === AzureQueryType.AzureMonitor && workingQuery.azureMonitor) {
        workingQuery = migrateMetricsDimensionFilters(workingQuery);
    }
    return workingQuery;
}
//# sourceMappingURL=migrateQuery.js.map