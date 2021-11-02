import { __assign } from "tslib";
import React, { useCallback } from 'react';
import { DataTransformerID, standardTransformers, } from '@grafana/data';
import { Select } from '@grafana/ui';
import { useAllFieldNamesFromDataFrames } from './utils';
export var SeriesToFieldsTransformerEditor = function (_a) {
    var input = _a.input, options = _a.options, onChange = _a.onChange;
    var fieldNames = useAllFieldNamesFromDataFrames(input).map(function (item) { return ({ label: item, value: item }); });
    var onSelectField = useCallback(function (value) {
        onChange(__assign(__assign({}, options), { byField: value.value }));
    }, [onChange, options]);
    return (React.createElement("div", { className: "gf-form-inline" },
        React.createElement("div", { className: "gf-form gf-form--grow" },
            React.createElement("div", { className: "gf-form-label width-8" }, "Field name"),
            React.createElement(Select, { menuShouldPortal: true, options: fieldNames, value: options.byField, onChange: onSelectField, isClearable: true }))));
};
export var seriesToFieldsTransformerRegistryItem = {
    id: DataTransformerID.seriesToColumns,
    editor: SeriesToFieldsTransformerEditor,
    transformation: standardTransformers.seriesToColumnsTransformer,
    name: 'Outer join',
    description: 'Joins many time series/tables by a field. This can be used to outer join multiple time series on the _time_ field to show many time series in one table.',
};
//# sourceMappingURL=SeriesToFieldsTransformerEditor.js.map