import React from 'react';
import { TableCellBackgroundDisplayMode } from '@grafana/schema';
import { Field, RadioButtonGroup } from '@grafana/ui';
const colorBackgroundOpts = [
    { value: TableCellBackgroundDisplayMode.Basic, label: 'Basic' },
    { value: TableCellBackgroundDisplayMode.Gradient, label: 'Gradient' },
];
export const ColorBackgroundCellOptionsEditor = ({ cellOptions, onChange, }) => {
    var _a;
    // Set the display mode on change
    const onCellOptionsChange = (v) => {
        cellOptions.mode = v;
        onChange(cellOptions);
    };
    return (React.createElement(Field, { label: "Background display mode" },
        React.createElement(RadioButtonGroup, { value: (_a = cellOptions === null || cellOptions === void 0 ? void 0 : cellOptions.mode) !== null && _a !== void 0 ? _a : TableCellBackgroundDisplayMode.Gradient, onChange: onCellOptionsChange, options: colorBackgroundOpts })));
};
//# sourceMappingURL=ColorBackgroundCellOptionsEditor.js.map