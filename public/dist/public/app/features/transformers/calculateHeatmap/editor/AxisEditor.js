import React, { useState } from 'react';
import { VariableOrigin } from '@grafana/data';
import { getTemplateSrv, config as cfg } from '@grafana/runtime';
import { HeatmapCalculationMode } from '@grafana/schema';
import { HorizontalGroup, Input, RadioButtonGroup, ScaleDistribution } from '@grafana/ui';
import { SuggestionsInput } from '../../suggestionsInput/SuggestionsInput';
import { numberOrVariableValidator } from '../../utils';
const modeOptions = [
    {
        label: 'Size',
        value: HeatmapCalculationMode.Size,
        description: 'Split the buckets based on size',
    },
    {
        label: 'Count',
        value: HeatmapCalculationMode.Count,
        description: 'Split the buckets based on count',
    },
];
const logModeOptions = [
    {
        label: 'Split',
        value: HeatmapCalculationMode.Size,
        description: 'Split the buckets based on size',
    },
];
export const AxisEditor = ({ value, onChange, item }) => {
    var _a, _b, _c;
    const [isInvalid, setInvalid] = useState(false);
    const onValueChange = (bucketValue) => {
        setInvalid(!numberOrVariableValidator(bucketValue));
        onChange(Object.assign(Object.assign({}, value), { value: bucketValue }));
    };
    const templateSrv = getTemplateSrv();
    const variables = templateSrv.getVariables().map((v) => {
        return { value: v.name, label: v.label || v.name, origin: VariableOrigin.Template };
    });
    return (React.createElement(HorizontalGroup, null,
        React.createElement(RadioButtonGroup, { value: (value === null || value === void 0 ? void 0 : value.mode) || HeatmapCalculationMode.Size, options: ((_a = value === null || value === void 0 ? void 0 : value.scale) === null || _a === void 0 ? void 0 : _a.type) === ScaleDistribution.Log ? logModeOptions : modeOptions, onChange: (mode) => {
                onChange(Object.assign(Object.assign({}, value), { mode }));
            } }),
        cfg.featureToggles.transformationsVariableSupport ? (React.createElement(SuggestionsInput, { invalid: isInvalid, error: 'Value needs to be an integer or a variable', value: (_b = value === null || value === void 0 ? void 0 : value.value) !== null && _b !== void 0 ? _b : '', placeholder: "Auto", onChange: onValueChange, suggestions: variables })) : (React.createElement(Input, { value: (_c = value === null || value === void 0 ? void 0 : value.value) !== null && _c !== void 0 ? _c : '', placeholder: "Auto", onChange: (v) => {
                onChange(Object.assign(Object.assign({}, value), { value: v.currentTarget.value }));
            } }))));
};
//# sourceMappingURL=AxisEditor.js.map