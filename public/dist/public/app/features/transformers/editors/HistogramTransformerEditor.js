import React, { useCallback, useState } from 'react';
import { DataTransformerID, standardTransformers, TransformerCategory, VariableOrigin, } from '@grafana/data';
import { histogramFieldInfo, } from '@grafana/data/src/transformations/transformers/histogram';
import { getTemplateSrv, config as cfg } from '@grafana/runtime';
import { InlineField, InlineFieldRow, InlineSwitch } from '@grafana/ui';
import { NumberInput } from 'app/core/components/OptionsUI/NumberInput';
import { SuggestionsInput } from '../suggestionsInput/SuggestionsInput';
import { numberOrVariableValidator } from '../utils';
export const HistogramTransformerEditor = ({ input, options, onChange, }) => {
    var _a, _b;
    const labelWidth = 18;
    const [isInvalid, setInvalid] = useState({
        bucketSize: !numberOrVariableValidator(options.bucketSize || ''),
        bucketOffset: !numberOrVariableValidator(options.bucketOffset || ''),
    });
    const onBucketSizeChanged = useCallback((val) => {
        onChange(Object.assign(Object.assign({}, options), { bucketSize: val }));
    }, [onChange, options]);
    const onBucketOffsetChanged = useCallback((val) => {
        onChange(Object.assign(Object.assign({}, options), { bucketOffset: val }));
    }, [onChange, options]);
    const onVariableBucketSizeChanged = useCallback((value) => {
        setInvalid(Object.assign(Object.assign({}, isInvalid), { bucketSize: !numberOrVariableValidator(value) }));
        onChange(Object.assign(Object.assign({}, options), { bucketSize: value }));
    }, [onChange, options, isInvalid, setInvalid]);
    const onVariableBucketOffsetChanged = useCallback((value) => {
        setInvalid(Object.assign(Object.assign({}, isInvalid), { bucketOffset: !numberOrVariableValidator(value) }));
        onChange(Object.assign(Object.assign({}, options), { bucketOffset: value }));
    }, [onChange, options, isInvalid, setInvalid]);
    const onToggleCombine = useCallback(() => {
        onChange(Object.assign(Object.assign({}, options), { combine: !options.combine }));
    }, [onChange, options]);
    const templateSrv = getTemplateSrv();
    const variables = templateSrv.getVariables().map((v) => {
        return { value: v.name, label: v.label || v.name, origin: VariableOrigin.Template };
    });
    if (!cfg.featureToggles.transformationsVariableSupport) {
        let bucketSize;
        if (typeof options.bucketSize === 'string') {
            bucketSize = parseInt(options.bucketSize, 10);
        }
        else {
            bucketSize = options.bucketSize;
        }
        let bucketOffset;
        if (typeof options.bucketOffset === 'string') {
            bucketOffset = parseInt(options.bucketOffset, 10);
        }
        else {
            bucketOffset = options.bucketOffset;
        }
        return (React.createElement("div", null,
            React.createElement(InlineFieldRow, null,
                React.createElement(InlineField, { labelWidth: labelWidth, label: histogramFieldInfo.bucketSize.name, tooltip: histogramFieldInfo.bucketSize.description },
                    React.createElement(NumberInput, { value: bucketSize, placeholder: "auto", onChange: onBucketSizeChanged, min: 0 }))),
            React.createElement(InlineFieldRow, null,
                React.createElement(InlineField, { labelWidth: labelWidth, label: histogramFieldInfo.bucketOffset.name, tooltip: histogramFieldInfo.bucketOffset.description },
                    React.createElement(NumberInput, { value: bucketOffset, placeholder: "none", onChange: onBucketOffsetChanged, min: 0 }))),
            React.createElement(InlineFieldRow, null,
                React.createElement(InlineField, { labelWidth: labelWidth, label: histogramFieldInfo.combine.name, tooltip: histogramFieldInfo.combine.description },
                    React.createElement(InlineSwitch, { value: (_a = options.combine) !== null && _a !== void 0 ? _a : false, onChange: onToggleCombine })))));
    }
    return (React.createElement("div", null,
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { invalid: isInvalid.bucketSize, error: 'Value needs to be an integer or a variable', labelWidth: labelWidth, label: histogramFieldInfo.bucketSize.name, tooltip: histogramFieldInfo.bucketSize.description },
                React.createElement(SuggestionsInput, { suggestions: variables, value: options.bucketSize, placeholder: "auto", onChange: onVariableBucketSizeChanged }))),
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { labelWidth: labelWidth, label: histogramFieldInfo.bucketOffset.name, tooltip: histogramFieldInfo.bucketOffset.description, invalid: isInvalid.bucketOffset, error: 'Value needs to be an integer or a variable' },
                React.createElement(SuggestionsInput, { suggestions: variables, value: options.bucketOffset, placeholder: "none", onChange: onVariableBucketOffsetChanged }))),
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { labelWidth: labelWidth, label: histogramFieldInfo.combine.name, tooltip: histogramFieldInfo.combine.description },
                React.createElement(InlineSwitch, { value: (_b = options.combine) !== null && _b !== void 0 ? _b : false, onChange: onToggleCombine })))));
};
export const histogramTransformRegistryItem = {
    id: DataTransformerID.histogram,
    editor: HistogramTransformerEditor,
    transformation: standardTransformers.histogramTransformer,
    name: standardTransformers.histogramTransformer.name,
    description: standardTransformers.histogramTransformer.description,
    categories: new Set([TransformerCategory.CreateNewVisualization]),
};
//# sourceMappingURL=HistogramTransformerEditor.js.map