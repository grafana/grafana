import { __assign } from "tslib";
import React from 'react';
import { InlineField, InlineFieldRow, Input, Select } from '@grafana/ui';
import { downsamplingTypes, upsamplingTypes } from '../types';
export var Resample = function (_a) {
    var labelWidth = _a.labelWidth, onChange = _a.onChange, refIds = _a.refIds, query = _a.query;
    var downsampler = downsamplingTypes.find(function (o) { return o.value === query.downsampler; });
    var upsampler = upsamplingTypes.find(function (o) { return o.value === query.upsampler; });
    var onWindowChange = function (event) {
        onChange(__assign(__assign({}, query), { window: event.target.value }));
    };
    var onRefIdChange = function (value) {
        onChange(__assign(__assign({}, query), { expression: value.value }));
    };
    var onSelectDownsampler = function (value) {
        onChange(__assign(__assign({}, query), { downsampler: value.value }));
    };
    var onSelectUpsampler = function (value) {
        onChange(__assign(__assign({}, query), { upsampler: value.value }));
    };
    return (React.createElement(React.Fragment, null,
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Input", labelWidth: labelWidth },
                React.createElement(Select, { menuShouldPortal: true, onChange: onRefIdChange, options: refIds, value: query.expression, width: 20 }))),
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Resample to", labelWidth: labelWidth, tooltip: "10s, 1m, 30m, 1h" },
                React.createElement(Input, { onChange: onWindowChange, value: query.window, width: 15 })),
            React.createElement(InlineField, { label: "Downsample" },
                React.createElement(Select, { menuShouldPortal: true, options: downsamplingTypes, value: downsampler, onChange: onSelectDownsampler, width: 25 })),
            React.createElement(InlineField, { label: "Upsample" },
                React.createElement(Select, { menuShouldPortal: true, options: upsamplingTypes, value: upsampler, onChange: onSelectUpsampler, width: 25 })))));
};
//# sourceMappingURL=Resample.js.map