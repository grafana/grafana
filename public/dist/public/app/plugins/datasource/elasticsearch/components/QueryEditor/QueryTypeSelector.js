import React from 'react';
import { RadioButtonGroup } from '@grafana/ui';
import { useDispatch } from '../../hooks/useStatelessReducer';
import { useQuery } from './ElasticsearchQueryContext';
import { changeMetricType } from './MetricAggregationsEditor/state/actions';
import { metricAggregationConfig } from './MetricAggregationsEditor/utils';
const OPTIONS = [
    { value: 'metrics', label: 'Metrics' },
    { value: 'logs', label: 'Logs' },
    { value: 'raw_data', label: 'Raw Data' },
    { value: 'raw_document', label: 'Raw Document' },
];
function queryTypeToMetricType(type) {
    switch (type) {
        case 'logs':
        case 'raw_data':
        case 'raw_document':
            return type;
        case 'metrics':
            return 'count';
        default:
            // should never happen
            throw new Error(`invalid query type: ${type}`);
    }
}
export const QueryTypeSelector = () => {
    var _a;
    const query = useQuery();
    const dispatch = useDispatch();
    const firstMetric = (_a = query.metrics) === null || _a === void 0 ? void 0 : _a[0];
    if (firstMetric == null) {
        // not sure if this can really happen, but we should handle it anyway
        return null;
    }
    const queryType = metricAggregationConfig[firstMetric.type].impliedQueryType;
    const onChange = (newQueryType) => {
        dispatch(changeMetricType({ id: firstMetric.id, type: queryTypeToMetricType(newQueryType) }));
    };
    return React.createElement(RadioButtonGroup, { fullWidth: false, options: OPTIONS, value: queryType, onChange: onChange });
};
//# sourceMappingURL=QueryTypeSelector.js.map