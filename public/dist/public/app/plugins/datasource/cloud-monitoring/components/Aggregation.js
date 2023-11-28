import React, { useMemo } from 'react';
import { EditorField } from '@grafana/experimental';
import { Select } from '@grafana/ui';
import { getAggregationOptionsByMetric } from '../functions';
export const Aggregation = (props) => {
    const aggOptions = useAggregationOptionsByMetric(props);
    const selected = useSelectedFromOptions(aggOptions, props);
    return (React.createElement(EditorField, { label: "Group by function", "data-testid": "cloud-monitoring-aggregation" },
        React.createElement(Select, { width: "auto", onChange: ({ value }) => props.onChange(value), value: selected, options: [
                {
                    label: 'Template Variables',
                    options: props.templateVariableOptions,
                },
                {
                    label: 'Aggregations',
                    expanded: true,
                    options: aggOptions,
                },
            ], placeholder: "Select Reducer", inputId: `${props.refId}-group-by-function`, menuPlacement: "top" })));
};
const useAggregationOptionsByMetric = ({ metricDescriptor }) => {
    const valueType = metricDescriptor === null || metricDescriptor === void 0 ? void 0 : metricDescriptor.valueType;
    const metricKind = metricDescriptor === null || metricDescriptor === void 0 ? void 0 : metricDescriptor.metricKind;
    return useMemo(() => {
        if (!valueType || !metricKind) {
            return [];
        }
        return getAggregationOptionsByMetric(valueType, metricKind).map((a) => (Object.assign(Object.assign({}, a), { label: a.text })));
    }, [valueType, metricKind]);
};
const useSelectedFromOptions = (aggOptions, props) => {
    return useMemo(() => {
        const allOptions = [...aggOptions, ...props.templateVariableOptions];
        return allOptions.find((s) => s.value === props.crossSeriesReducer);
    }, [aggOptions, props.crossSeriesReducer, props.templateVariableOptions]);
};
//# sourceMappingURL=Aggregation.js.map