import React from 'react';
import { InlineField, InlineFieldRow, Input, Select } from '@grafana/ui';
import { ReducerMode, reducerModes, reducerTypes } from '../types';
export const Reduce = ({ labelWidth = 'auto', onChange, refIds, query }) => {
    var _a, _b;
    const reducer = reducerTypes.find((o) => o.value === query.reducer);
    const onRefIdChange = (value) => {
        onChange(Object.assign(Object.assign({}, query), { expression: value.value }));
    };
    const onSelectReducer = (value) => {
        onChange(Object.assign(Object.assign({}, query), { reducer: value.value }));
    };
    const onSettingsChanged = (settings) => {
        onChange(Object.assign(Object.assign({}, query), { settings: settings }));
    };
    const onModeChanged = (value) => {
        var _a, _b, _c;
        let newSettings;
        switch (value.value) {
            case ReducerMode.ReplaceNonNumbers:
                let replaceWithNumber = 0;
                if (((_a = query.settings) === null || _a === void 0 ? void 0 : _a.mode) === ReducerMode.ReplaceNonNumbers) {
                    replaceWithNumber = (_c = (_b = query.settings) === null || _b === void 0 ? void 0 : _b.replaceWithValue) !== null && _c !== void 0 ? _c : 0;
                }
                newSettings = {
                    mode: ReducerMode.ReplaceNonNumbers,
                    replaceWithValue: replaceWithNumber,
                };
                break;
            default:
                newSettings = {
                    mode: value.value,
                };
        }
        onSettingsChanged(newSettings);
    };
    const onReplaceWithChanged = (e) => {
        const value = e.currentTarget.valueAsNumber;
        onSettingsChanged({ mode: ReducerMode.ReplaceNonNumbers, replaceWithValue: value !== null && value !== void 0 ? value : 0 });
    };
    const mode = (_b = (_a = query.settings) === null || _a === void 0 ? void 0 : _a.mode) !== null && _b !== void 0 ? _b : ReducerMode.Strict;
    const replaceWithNumber = () => {
        var _a, _b;
        if (mode !== ReducerMode.ReplaceNonNumbers) {
            return;
        }
        return (React.createElement(InlineField, { label: "Replace With", labelWidth: labelWidth },
            React.createElement(Input, { type: "number", width: 10, onChange: onReplaceWithChanged, value: (_b = (_a = query.settings) === null || _a === void 0 ? void 0 : _a.replaceWithValue) !== null && _b !== void 0 ? _b : 0 })));
    };
    return (React.createElement(React.Fragment, null,
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Input", labelWidth: labelWidth },
                React.createElement(Select, { onChange: onRefIdChange, options: refIds, value: query.expression, width: 'auto' }))),
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Function", labelWidth: labelWidth },
                React.createElement(Select, { options: reducerTypes, value: reducer, onChange: onSelectReducer, width: 20 })),
            React.createElement(InlineField, { label: "Mode", labelWidth: labelWidth },
                React.createElement(Select, { onChange: onModeChanged, options: reducerModes, value: mode, width: 25 })),
            replaceWithNumber())));
};
//# sourceMappingURL=Reduce.js.map