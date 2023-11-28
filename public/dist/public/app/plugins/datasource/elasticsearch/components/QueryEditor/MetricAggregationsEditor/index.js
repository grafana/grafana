import React from 'react';
import { Alert, Button } from '@grafana/ui';
import { useDispatch } from '../../../hooks/useStatelessReducer';
import { useQuery } from '../ElasticsearchQueryContext';
import { QueryEditorRow } from '../QueryEditorRow';
import { QueryEditorSpecialMetricRow } from '../QueryEditorSpecialMetricRow';
import { MetricEditor } from './MetricEditor';
import { addMetric, removeMetric, toggleMetricVisibility } from './state/actions';
import { metricAggregationConfig } from './utils';
export const MetricAggregationsEditor = ({ nextId }) => {
    const dispatch = useDispatch();
    const { metrics } = useQuery();
    const totalMetrics = (metrics === null || metrics === void 0 ? void 0 : metrics.length) || 0;
    return (React.createElement(React.Fragment, null, metrics === null || metrics === void 0 ? void 0 : metrics.map((metric, index) => {
        switch (metric.type) {
            case 'logs':
                return React.createElement(QueryEditorSpecialMetricRow, { key: `${metric.type}-${metric.id}`, name: "Logs", metric: metric });
            case 'raw_data':
                return React.createElement(QueryEditorSpecialMetricRow, { key: `${metric.type}-${metric.id}`, name: "Raw Data", metric: metric });
            case 'raw_document':
                return (React.createElement(React.Fragment, null,
                    React.createElement(QueryEditorSpecialMetricRow, { key: `${metric.type}-${metric.id}`, name: "Raw Document", metric: metric }),
                    React.createElement(Alert, { severity: "warning", title: "The 'Raw Document' query type is deprecated." })));
            default:
                return (React.createElement(QueryEditorRow, { key: `${metric.type}-${metric.id}`, label: `Metric (${metric.id})`, hidden: metric.hide, onHideClick: () => dispatch(toggleMetricVisibility(metric.id)), onRemoveClick: totalMetrics > 1 && (() => dispatch(removeMetric(metric.id))) },
                    React.createElement(MetricEditor, { value: metric }),
                    metricAggregationConfig[metric.type].impliedQueryType === 'metrics' && index === 0 && (React.createElement(Button, { variant: "secondary", fill: "text", icon: "plus", onClick: () => dispatch(addMetric(nextId)), tooltip: "Add metric", "aria-label": "Add metric" }))));
        }
    })));
};
//# sourceMappingURL=index.js.map