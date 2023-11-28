import { map } from 'lodash';
export const hasOption = (options, value) => options.some((v) => (v.options ? hasOption(v.options, value) : v.value === value));
export const findOptions = (options, values = []) => {
    if (values.length === 0) {
        return [];
    }
    const set = values.reduce((accum, item) => {
        accum.add(item);
        return accum;
    }, new Set());
    return options.filter((option) => set.has(option.value));
};
export const toOption = (v) => ({ value: v.value, label: v.text });
export const addValueToOptions = (values, variableOptionGroup, value) => {
    const options = [...values, variableOptionGroup];
    const optionValues = values.map((m) => m.value.toLowerCase()).concat(variableOptionGroup.options.map((p) => p.value));
    if (value && !optionValues.includes(value.toLowerCase())) {
        options.push({ label: value, value });
    }
    return options;
};
// Route definitions shared with the backend.
// Check: /pkg/tsdb/azuremonitor/azuremonitor-resource-handler.go <registerRoutes>
export const routeNames = {
    azureMonitor: 'azuremonitor',
    logAnalytics: 'loganalytics',
    appInsights: 'appinsights',
    resourceGraph: 'resourcegraph',
};
export function interpolateVariable(value, variable) {
    if (typeof value === 'string') {
        // When enabling multiple responses, quote the value to mimic the array result below
        // even if only one response is selected. This does not apply if only the "include all"
        // option is enabled but with a custom value.
        if (variable.multi || (variable.includeAll && !variable.allValue)) {
            return "'" + value + "'";
        }
        else {
            return value;
        }
    }
    if (typeof value === 'number') {
        return value;
    }
    const quotedValues = map(value, (val) => {
        if (typeof value === 'number') {
            return value;
        }
        return "'" + val + "'";
    });
    return quotedValues.join(',');
}
//# sourceMappingURL=common.js.map