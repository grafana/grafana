import React from 'react';
import { InlineField, InlineFieldRow, Input, Select } from '@grafana/ui';
import { downsamplingTypes, upsamplingTypes } from '../types';
export const Resample = ({ labelWidth = 'auto', onChange, refIds, query }) => {
    const downsampler = downsamplingTypes.find((o) => o.value === query.downsampler);
    const upsampler = upsamplingTypes.find((o) => o.value === query.upsampler);
    const onWindowChange = (event) => {
        onChange(Object.assign(Object.assign({}, query), { window: event.target.value }));
    };
    const onRefIdChange = (value) => {
        onChange(Object.assign(Object.assign({}, query), { expression: value.value }));
    };
    const onSelectDownsampler = (value) => {
        onChange(Object.assign(Object.assign({}, query), { downsampler: value.value }));
    };
    const onSelectUpsampler = (value) => {
        onChange(Object.assign(Object.assign({}, query), { upsampler: value.value }));
    };
    return (React.createElement(React.Fragment, null,
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Input", labelWidth: labelWidth },
                React.createElement(Select, { onChange: onRefIdChange, options: refIds, value: query.expression, width: 20 }))),
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Resample to", labelWidth: labelWidth, tooltip: "10s, 1m, 30m, 1h" },
                React.createElement(Input, { onChange: onWindowChange, value: query.window, width: 15 })),
            React.createElement(InlineField, { label: "Downsample" },
                React.createElement(Select, { options: downsamplingTypes, value: downsampler, onChange: onSelectDownsampler, width: 25 })),
            React.createElement(InlineField, { label: "Upsample" },
                React.createElement(Select, { options: upsamplingTypes, value: upsampler, onChange: onSelectUpsampler, width: 25 })))));
};
//# sourceMappingURL=Resample.js.map