import { __assign } from "tslib";
import React from 'react';
import { InlineField, InlineFieldRow, Select } from '@grafana/ui';
import { reducerTypes } from '../types';
export var Reduce = function (_a) {
    var labelWidth = _a.labelWidth, onChange = _a.onChange, refIds = _a.refIds, query = _a.query;
    var reducer = reducerTypes.find(function (o) { return o.value === query.reducer; });
    var onRefIdChange = function (value) {
        onChange(__assign(__assign({}, query), { expression: value.value }));
    };
    var onSelectReducer = function (value) {
        onChange(__assign(__assign({}, query), { reducer: value.value }));
    };
    return (React.createElement(InlineFieldRow, null,
        React.createElement(InlineField, { label: "Function", labelWidth: labelWidth },
            React.createElement(Select, { menuShouldPortal: true, options: reducerTypes, value: reducer, onChange: onSelectReducer, width: 25 })),
        React.createElement(InlineField, { label: "Input", labelWidth: labelWidth },
            React.createElement(Select, { menuShouldPortal: true, onChange: onRefIdChange, options: refIds, value: query.expression, width: 20 }))));
};
//# sourceMappingURL=Reduce.js.map