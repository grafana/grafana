import { __assign, __read } from "tslib";
import React, { useCallback, useState } from 'react';
import { Select } from '@grafana/ui';
import { Field } from '../Field';
import { AzureQueryType } from '../../types';
var QueryTypeField = function (_a) {
    var query = _a.query, onQueryChange = _a.onQueryChange;
    // Use useState to capture the initial value on first mount. We're not interested in when it changes
    // We only show App Insights and Insights Analytics if they were initially selected. Otherwise, hide them.
    var _b = __read(useState(query.queryType), 1), initialQueryType = _b[0];
    var showAppInsights = initialQueryType === AzureQueryType.ApplicationInsights || initialQueryType === AzureQueryType.InsightsAnalytics;
    var queryTypes = [
        { value: AzureQueryType.AzureMonitor, label: 'Metrics' },
        { value: AzureQueryType.LogAnalytics, label: 'Logs' },
        { value: AzureQueryType.AzureResourceGraph, label: 'Azure Resource Graph' },
    ];
    if (showAppInsights) {
        queryTypes.push({ value: AzureQueryType.ApplicationInsights, label: 'Application Insights' }, { value: AzureQueryType.InsightsAnalytics, label: 'Insights Analytics' });
    }
    var handleChange = useCallback(function (change) {
        change.value &&
            onQueryChange(__assign(__assign({}, query), { queryType: change.value }));
    }, [onQueryChange, query]);
    return (React.createElement(Field, { label: "Service" },
        React.createElement(Select, { menuShouldPortal: true, inputId: "azure-monitor-query-type-field", value: query.queryType, options: queryTypes, onChange: handleChange, width: 38 })));
};
export default QueryTypeField;
//# sourceMappingURL=QueryTypeField.js.map