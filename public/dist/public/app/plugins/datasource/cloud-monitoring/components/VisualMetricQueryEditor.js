import { __assign } from "tslib";
import React from 'react';
import { Metrics, LabelFilter, GroupBy, Preprocessor, Alignment } from '.';
function Editor(_a) {
    var query = _a.query, labels = _a.labels, datasource = _a.datasource, onChange = _a.onChange, onMetricTypeChange = _a.onMetricTypeChange, customMetaData = _a.customMetaData, variableOptionGroup = _a.variableOptionGroup;
    return (React.createElement(Metrics, { templateSrv: datasource.templateSrv, projectName: query.projectName, metricType: query.metricType, templateVariableOptions: variableOptionGroup.options, datasource: datasource, onChange: onMetricTypeChange }, function (metric) { return (React.createElement(React.Fragment, null,
        React.createElement(LabelFilter, { labels: labels, filters: query.filters, onChange: function (filters) { return onChange(__assign(__assign({}, query), { filters: filters })); }, variableOptionGroup: variableOptionGroup }),
        React.createElement(Preprocessor, { metricDescriptor: metric, query: query, onChange: onChange }),
        React.createElement(GroupBy, { labels: Object.keys(labels), query: query, onChange: onChange, variableOptionGroup: variableOptionGroup, metricDescriptor: metric }),
        React.createElement(Alignment, { datasource: datasource, templateVariableOptions: variableOptionGroup.options, query: query, customMetaData: customMetaData, onChange: onChange }))); }));
}
export var VisualMetricQueryEditor = React.memo(Editor);
//# sourceMappingURL=VisualMetricQueryEditor.js.map