import React, { useMemo } from 'react';
import { EditorField } from '@grafana/experimental';
import { RadioButtonGroup } from '@grafana/ui';
import { getAlignmentPickerData } from '../functions';
import { PreprocessorType, MetricKind, ValueTypes } from '../types/query';
const NONE_OPTION = { label: 'None', value: PreprocessorType.None };
export const Preprocessor = ({ query, metricDescriptor, onChange }) => {
    var _a;
    const options = useOptions(metricDescriptor);
    return (React.createElement(EditorField, { label: "Pre-processing", tooltip: "Preprocessing options are displayed when the selected metric has a metric kind of delta or cumulative. The specific options available are determined by the metric's value type. If you select 'Rate', data points are aligned and converted to a rate per time series. If you select 'Delta', data points are aligned by their delta (difference) per time series" },
        React.createElement(RadioButtonGroup, { onChange: (value) => {
                const { perSeriesAligner: psa } = query;
                const { valueType, metricKind } = metricDescriptor !== null && metricDescriptor !== void 0 ? metricDescriptor : {};
                const { perSeriesAligner } = getAlignmentPickerData(valueType, metricKind, psa, value);
                onChange(Object.assign(Object.assign({}, query), { preprocessor: value, perSeriesAligner }));
            }, value: (_a = query.preprocessor) !== null && _a !== void 0 ? _a : PreprocessorType.None, options: options })));
};
const useOptions = (metricDescriptor) => {
    const metricKind = metricDescriptor === null || metricDescriptor === void 0 ? void 0 : metricDescriptor.metricKind;
    const valueType = metricDescriptor === null || metricDescriptor === void 0 ? void 0 : metricDescriptor.valueType;
    return useMemo(() => {
        if (!metricKind || metricKind === MetricKind.GAUGE || valueType === ValueTypes.DISTRIBUTION) {
            return [NONE_OPTION];
        }
        const options = [
            NONE_OPTION,
            {
                label: 'Rate',
                value: PreprocessorType.Rate,
                description: 'Data points are aligned and converted to a rate per time series',
            },
        ];
        return metricKind === MetricKind.CUMULATIVE
            ? [
                ...options,
                {
                    label: 'Delta',
                    value: PreprocessorType.Delta,
                    description: 'Data points are aligned by their delta (difference) per time series',
                },
            ]
            : options;
    }, [metricKind, valueType]);
};
//# sourceMappingURL=Preprocessor.js.map