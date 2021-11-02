import React from 'react';
import { MetricEditor } from './MetricEditor';
import { useDispatch } from '../../../hooks/useStatelessReducer';
import { metricAggregationConfig } from './utils';
import { addMetric, removeMetric, toggleMetricVisibility } from './state/actions';
import { useQuery } from '../ElasticsearchQueryContext';
import { QueryEditorRow } from '../QueryEditorRow';
import { IconButton } from '../../IconButton';
export var MetricAggregationsEditor = function (_a) {
    var nextId = _a.nextId;
    var dispatch = useDispatch();
    var metrics = useQuery().metrics;
    var totalMetrics = (metrics === null || metrics === void 0 ? void 0 : metrics.length) || 0;
    return (React.createElement(React.Fragment, null, metrics === null || metrics === void 0 ? void 0 : metrics.map(function (metric, index) { return (React.createElement(QueryEditorRow, { key: metric.type + "-" + metric.id, label: "Metric (" + metric.id + ")", hidden: metric.hide, onHideClick: function () { return dispatch(toggleMetricVisibility(metric.id)); }, onRemoveClick: totalMetrics > 1 && (function () { return dispatch(removeMetric(metric.id)); }) },
        React.createElement(MetricEditor, { value: metric }),
        !metricAggregationConfig[metric.type].isSingleMetric && index === 0 && (React.createElement(IconButton, { iconName: "plus", onClick: function () { return dispatch(addMetric(nextId)); }, label: "add" })))); })));
};
//# sourceMappingURL=index.js.map