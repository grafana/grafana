import { __assign } from "tslib";
import React, { useCallback } from 'react';
import { DataTransformerID, standardTransformers } from '@grafana/data';
import { histogramFieldInfo, } from '@grafana/data/src/transformations/transformers/histogram';
import { InlineField, InlineFieldRow, InlineSwitch, Input } from '@grafana/ui';
export var HistogramTransformerEditor = function (_a) {
    var _b;
    var input = _a.input, options = _a.options, onChange = _a.onChange;
    var labelWidth = 18;
    var onBucketSizeChanged = useCallback(function (evt) {
        var val = evt.currentTarget.valueAsNumber;
        onChange(__assign(__assign({}, options), { bucketSize: isNaN(val) ? undefined : val }));
    }, [onChange, options]);
    var onBucketOffsetChanged = useCallback(function (evt) {
        var val = evt.currentTarget.valueAsNumber;
        onChange(__assign(__assign({}, options), { bucketOffset: isNaN(val) ? undefined : val }));
    }, [onChange, options]);
    var onToggleCombine = useCallback(function () {
        onChange(__assign(__assign({}, options), { combine: !options.combine }));
    }, [onChange, options]);
    return (React.createElement("div", null,
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { labelWidth: labelWidth, label: histogramFieldInfo.bucketSize.name, tooltip: histogramFieldInfo.bucketSize.description },
                React.createElement(Input, { type: "number", value: options.bucketSize, placeholder: "auto", onChange: onBucketSizeChanged, min: 0 }))),
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { labelWidth: labelWidth, label: histogramFieldInfo.bucketOffset.name, tooltip: histogramFieldInfo.bucketOffset.description },
                React.createElement(Input, { type: "number", value: options.bucketOffset, placeholder: "none", onChange: onBucketOffsetChanged, min: 0 }))),
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { labelWidth: labelWidth, label: histogramFieldInfo.combine.name, tooltip: histogramFieldInfo.combine.description },
                React.createElement(InlineSwitch, { value: (_b = options.combine) !== null && _b !== void 0 ? _b : false, onChange: onToggleCombine })))));
};
export var histogramTransformRegistryItem = {
    id: DataTransformerID.histogram,
    editor: HistogramTransformerEditor,
    transformation: standardTransformers.histogramTransformer,
    name: standardTransformers.histogramTransformer.name,
    description: standardTransformers.histogramTransformer.description,
};
//# sourceMappingURL=HistogramTransformerEditor.js.map