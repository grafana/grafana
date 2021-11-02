import React from 'react';
import { getDefaultTimeRange } from '@grafana/data';
import { ElasticsearchProvider } from './ElasticsearchQueryContext';
import { InlineField, InlineFieldRow, Input, QueryField } from '@grafana/ui';
import { changeAliasPattern, changeQuery } from './state';
import { MetricAggregationsEditor } from './MetricAggregationsEditor';
import { BucketAggregationsEditor } from './BucketAggregationsEditor';
import { useDispatch } from '../../hooks/useStatelessReducer';
import { useNextId } from '../../hooks/useNextId';
import { metricAggregationConfig } from './MetricAggregationsEditor/utils';
export var QueryEditor = function (_a) {
    var query = _a.query, onChange = _a.onChange, onRunQuery = _a.onRunQuery, datasource = _a.datasource, range = _a.range;
    return (React.createElement(ElasticsearchProvider, { datasource: datasource, onChange: onChange, onRunQuery: onRunQuery, query: query, range: range || getDefaultTimeRange() },
        React.createElement(QueryEditorForm, { value: query })));
};
var QueryEditorForm = function (_a) {
    var _b, _c, _d;
    var value = _a.value;
    var dispatch = useDispatch();
    var nextId = useNextId();
    // To be considered a time series query, the last bucked aggregation must be a Date Histogram
    var isTimeSeriesQuery = ((_c = (_b = value.bucketAggs) === null || _b === void 0 ? void 0 : _b.slice(-1)[0]) === null || _c === void 0 ? void 0 : _c.type) === 'date_histogram';
    var showBucketAggregationsEditor = (_d = value.metrics) === null || _d === void 0 ? void 0 : _d.every(function (metric) { return !metricAggregationConfig[metric.type].isSingleMetric; });
    return (React.createElement(React.Fragment, null,
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Query", labelWidth: 17, grow: true },
                React.createElement(QueryField, { query: value.query, 
                    // By default QueryField calls onChange if onBlur is not defined, this will trigger a rerender
                    // And slate will claim the focus, making it impossible to leave the field.
                    onBlur: function () { }, onChange: function (query) { return dispatch(changeQuery(query)); }, placeholder: "Lucene Query", portalOrigin: "elasticsearch" })),
            React.createElement(InlineField, { label: "Alias", labelWidth: 15, disabled: !isTimeSeriesQuery, tooltip: "Aliasing only works for timeseries queries (when the last group is 'Date Histogram'). For all other query types this field is ignored." },
                React.createElement(Input, { id: "ES-query-" + value.refId + "_alias", placeholder: "Alias Pattern", onBlur: function (e) { return dispatch(changeAliasPattern(e.currentTarget.value)); }, defaultValue: value.alias }))),
        React.createElement(MetricAggregationsEditor, { nextId: nextId }),
        showBucketAggregationsEditor && React.createElement(BucketAggregationsEditor, { nextId: nextId })));
};
//# sourceMappingURL=index.js.map