import React from 'react';
import { Stack } from '@grafana/experimental';
import { BarGaugeDisplayMode, BarGaugeValueMode } from '@grafana/schema';
import { Field, RadioButtonGroup } from '@grafana/ui';
export function BarGaugeCellOptionsEditor({ cellOptions, onChange }) {
    var _a, _b;
    // Set the display mode on change
    const onCellOptionsChange = (v) => {
        cellOptions.mode = v;
        onChange(cellOptions);
    };
    const onValueModeChange = (v) => {
        cellOptions.valueDisplayMode = v;
        onChange(cellOptions);
    };
    return (React.createElement(Stack, { direction: "column", gap: 0 },
        React.createElement(Field, { label: "Gauge display mode" },
            React.createElement(RadioButtonGroup, { value: (_a = cellOptions === null || cellOptions === void 0 ? void 0 : cellOptions.mode) !== null && _a !== void 0 ? _a : BarGaugeDisplayMode.Gradient, onChange: onCellOptionsChange, options: barGaugeOpts })),
        React.createElement(Field, { label: "Value display" },
            React.createElement(RadioButtonGroup, { value: (_b = cellOptions === null || cellOptions === void 0 ? void 0 : cellOptions.valueDisplayMode) !== null && _b !== void 0 ? _b : BarGaugeValueMode.Text, onChange: onValueModeChange, options: valueModes }))));
}
const barGaugeOpts = [
    { value: BarGaugeDisplayMode.Basic, label: 'Basic' },
    { value: BarGaugeDisplayMode.Gradient, label: 'Gradient' },
    { value: BarGaugeDisplayMode.Lcd, label: 'Retro LCD' },
];
const valueModes = [
    { value: BarGaugeValueMode.Color, label: 'Value color' },
    { value: BarGaugeValueMode.Text, label: 'Text color' },
    { value: BarGaugeValueMode.Hidden, label: 'Hidden' },
];
//# sourceMappingURL=BarGaugeCellOptionsEditor.js.map