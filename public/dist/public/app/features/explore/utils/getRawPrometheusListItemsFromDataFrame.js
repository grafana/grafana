import { formattedValueToString } from '@grafana/data/src';
export const RawPrometheusListItemEmptyValue = ' ';
/**
 * transform dataFrame to instantQueryRawVirtualizedListData
 * @param dataFrame
 */
export const getRawPrometheusListItemsFromDataFrame = (dataFrame) => {
    var _a, _b;
    const metricList = {};
    const outputList = [];
    // Filter out time
    const newFields = dataFrame.fields.filter((field) => !['Time'].includes(field.name));
    // Get name from each series
    let metricNames = (_b = (_a = newFields.find((field) => field.name === '__name__')) === null || _a === void 0 ? void 0 : _a.values) !== null && _b !== void 0 ? _b : [];
    if (!metricNames.length && newFields.length && newFields[0].values.length) {
        // These results do not have series labels
        // Matching the native prometheus UI which appears to only show the permutations of the first field in the query result.
        metricNames = Array(newFields[0].values.length).fill('');
    }
    // Get everything that isn't the name from each series
    const metricLabels = dataFrame.fields.filter((field) => !['__name__'].includes(field.name));
    metricNames.forEach(function (metric, i) {
        var _a;
        metricList[metric] = {};
        const formattedMetric = (_a = metricList[metric][i]) !== null && _a !== void 0 ? _a : {};
        for (const field of metricLabels) {
            const label = field.name;
            if (label !== 'Time') {
                // Initialize the objects
                if (typeof (field === null || field === void 0 ? void 0 : field.display) === 'function') {
                    const value = field === null || field === void 0 ? void 0 : field.display(field.values[i]);
                    if (!isNaN(value.numeric)) {
                        formattedMetric[label] = value.numeric.toString(10);
                    }
                    else {
                        const stringValue = formattedValueToString(value);
                        if (stringValue) {
                            formattedMetric[label] = stringValue;
                        }
                        else if (label.includes('Value #')) {
                            formattedMetric[label] = RawPrometheusListItemEmptyValue;
                        }
                    }
                }
                else {
                    console.warn('Field display method is missing!');
                }
            }
        }
        outputList.push(Object.assign(Object.assign({}, formattedMetric), { __name__: metric }));
    });
    return outputList;
};
//# sourceMappingURL=getRawPrometheusListItemsFromDataFrame.js.map