import React from 'react';
import { Alert, Input } from '@grafana/ui';
import { Field } from '../Field';
var ReadOnlyTimeGrain = function (_a) {
    var timeGrainCount = _a.timeGrainCount, timeGrainType = _a.timeGrainType, timeGrainUnit = _a.timeGrainUnit;
    var timeFields = timeGrainType === 'specific' ? ['specific', timeGrainCount, timeGrainUnit] : [timeGrainType];
    return (React.createElement(Field, { label: "Timegrain" },
        React.createElement(React.Fragment, null, timeFields.map(function (timeField) { return (React.createElement(Input, { value: timeField, disabled: true, onChange: function () { }, key: timeField, width: 10 })); }))));
};
var ApplicationInsightsEditor = function (_a) {
    var _b, _c, _d, _e, _f, _g, _h, _j;
    var query = _a.query;
    var groupBy = ((_b = query.appInsights) === null || _b === void 0 ? void 0 : _b.dimension) || [];
    return (React.createElement("div", { "data-testid": "azure-monitor-application-insights-query-editor" },
        React.createElement(Field, { label: "Metric", disabled: true },
            React.createElement(Input, { value: (_c = query.appInsights) === null || _c === void 0 ? void 0 : _c.metricName, disabled: true, onChange: function () { }, id: "azure-monitor-application-insights-metric" })),
        React.createElement(Field, { label: "Aggregation", disabled: true },
            React.createElement(Input, { value: (_d = query.appInsights) === null || _d === void 0 ? void 0 : _d.aggregation, disabled: true, onChange: function () { } })),
        groupBy.length > 0 && (React.createElement(Field, { label: "Group by" },
            React.createElement(React.Fragment, null, groupBy.map(function (dimension) { return (React.createElement(Input, { value: dimension, disabled: true, onChange: function () { }, key: dimension })); })))),
        React.createElement(Field, { label: "Filter", disabled: true },
            React.createElement(Input, { value: (_e = query.appInsights) === null || _e === void 0 ? void 0 : _e.dimensionFilter, disabled: true, onChange: function () { } })),
        React.createElement(ReadOnlyTimeGrain, { timeGrainCount: ((_f = query.appInsights) === null || _f === void 0 ? void 0 : _f.timeGrainCount) || '', timeGrainType: ((_g = query.appInsights) === null || _g === void 0 ? void 0 : _g.timeGrainType) || 'auto', timeGrainUnit: ((_h = query.appInsights) === null || _h === void 0 ? void 0 : _h.timeGrainUnit) || 'minute' }),
        React.createElement(Field, { label: "Legend format", disabled: true },
            React.createElement(Input, { placeholder: "Alias patterns", value: (_j = query.appInsights) === null || _j === void 0 ? void 0 : _j.alias, onChange: function () { }, disabled: true })),
        React.createElement(Alert, { severity: "info", title: "Deprecated" }, "Application Insights is deprecated and is now read only. Migrate your queries to Metrics to make changes.")));
};
export default ApplicationInsightsEditor;
//# sourceMappingURL=index.js.map