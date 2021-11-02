import { __assign } from "tslib";
import React, { useCallback } from 'react';
import { DataTransformerID, standardTransformers } from '@grafana/data';
import { InlineField, InlineSwitch, InlineFieldRow, Select } from '@grafana/ui';
import { useAllFieldNamesFromDataFrames } from './utils';
export var SortByTransformerEditor = function (_a) {
    var _b;
    var input = _a.input, options = _a.options, onChange = _a.onChange;
    var fieldNames = useAllFieldNamesFromDataFrames(input).map(function (item) { return ({ label: item, value: item }); });
    // Only supports single sort for now
    var onSortChange = useCallback(function (idx, cfg) {
        onChange(__assign(__assign({}, options), { sort: [cfg] }));
    }, [onChange, options]);
    var sorts = ((_b = options.sort) === null || _b === void 0 ? void 0 : _b.length) ? options.sort : [{}];
    return (React.createElement("div", null, sorts.map(function (s, index) {
        return (React.createElement(InlineFieldRow, { key: s.field + "/" + index },
            React.createElement(InlineField, { label: "Field", labelWidth: 10, grow: true },
                React.createElement(Select, { menuShouldPortal: true, options: fieldNames, value: s.field, placeholder: "Select field", onChange: function (v) {
                        onSortChange(index, __assign(__assign({}, s), { field: v.value }));
                    } })),
            React.createElement(InlineField, { label: "Reverse" },
                React.createElement(InlineSwitch, { value: !!s.desc, onChange: function () {
                        onSortChange(index, __assign(__assign({}, s), { desc: !!!s.desc }));
                    } }))));
    })));
};
export var sortByTransformRegistryItem = {
    id: DataTransformerID.sortBy,
    editor: SortByTransformerEditor,
    transformation: standardTransformers.sortByTransformer,
    name: standardTransformers.sortByTransformer.name,
    description: standardTransformers.sortByTransformer.description,
};
//# sourceMappingURL=SortByTransformerEditor.js.map