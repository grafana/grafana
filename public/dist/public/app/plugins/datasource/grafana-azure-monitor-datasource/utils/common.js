import { map } from 'lodash';
import { rangeUtil } from '@grafana/data';
import TimegrainConverter from '../time_grain_converter';
export var hasOption = function (options, value) {
    return options.some(function (v) { return (v.options ? hasOption(v.options, value) : v.value === value); });
};
export var findOptions = function (options, values) {
    if (values === void 0) { values = []; }
    if (values.length === 0) {
        return [];
    }
    var set = values.reduce(function (accum, item) {
        accum.add(item);
        return accum;
    }, new Set());
    return options.filter(function (option) { return set.has(option.value); });
};
export var toOption = function (v) { return ({ value: v.value, label: v.text }); };
export function convertTimeGrainsToMs(timeGrains) {
    var allowedTimeGrainsMs = [];
    timeGrains.forEach(function (tg) {
        if (tg.value !== 'auto') {
            allowedTimeGrainsMs.push(rangeUtil.intervalToMs(TimegrainConverter.createKbnUnitFromISO8601Duration(tg.value)));
        }
    });
    return allowedTimeGrainsMs;
}
// Route definitions shared with the backend.
// Check: /pkg/tsdb/azuremonitor/azuremonitor-resource-handler.go <registerRoutes>
export var routeNames = {
    azureMonitor: 'azuremonitor',
    logAnalytics: 'loganalytics',
    appInsights: 'appinsights',
    resourceGraph: 'resourcegraph',
};
export function interpolateVariable(value, variable) {
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
    var quotedValues = map(value, function (val) {
        if (typeof value === 'number') {
            return value;
        }
        return "'" + val + "'";
    });
    return quotedValues.join(',');
}
//# sourceMappingURL=common.js.map