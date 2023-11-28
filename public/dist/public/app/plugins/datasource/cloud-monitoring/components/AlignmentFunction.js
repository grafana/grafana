import React, { useMemo } from 'react';
import { Select } from '@grafana/ui';
import { getAlignmentPickerData } from '../functions';
export const AlignmentFunction = ({ inputId, query, templateVariableOptions, onChange, metricDescriptor, preprocessor, }) => {
    const { perSeriesAligner: psa } = query;
    let { valueType, metricKind } = metricDescriptor || {};
    const { perSeriesAligner, alignOptions } = useMemo(() => getAlignmentPickerData(valueType, metricKind, psa, preprocessor), [valueType, metricKind, psa, preprocessor]);
    return (React.createElement(Select, { onChange: ({ value }) => onChange(Object.assign(Object.assign({}, query), { perSeriesAligner: value })), value: [...alignOptions, ...templateVariableOptions].find((s) => s.value === perSeriesAligner), options: [
            {
                label: 'Template Variables',
                options: templateVariableOptions,
            },
            {
                label: 'Alignment options',
                expanded: true,
                options: alignOptions,
            },
        ], placeholder: "Select Alignment", inputId: inputId, menuPlacement: "top" }));
};
//# sourceMappingURL=AlignmentFunction.js.map