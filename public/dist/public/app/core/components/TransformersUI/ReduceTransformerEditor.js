import { __assign } from "tslib";
import React, { useCallback } from 'react';
import { LegacyForms, Select, StatsPicker } from '@grafana/ui';
import { DataTransformerID, standardTransformers, } from '@grafana/data';
import { ReduceTransformerMode } from '@grafana/data/src/transformations/transformers/reduce';
import { selectors } from '@grafana/e2e-selectors';
// TODO:  Minimal implementation, needs some <3
export var ReduceTransformerEditor = function (_a) {
    var options = _a.options, onChange = _a.onChange;
    var modes = [
        {
            label: 'Series to rows',
            value: ReduceTransformerMode.SeriesToRows,
            description: 'Create a table with one row for each series value',
        },
        {
            label: 'Reduce fields',
            value: ReduceTransformerMode.ReduceFields,
            description: 'Collapse each field into a single value',
        },
    ];
    var onSelectMode = useCallback(function (value) {
        var mode = value.value;
        onChange(__assign(__assign({}, options), { mode: mode, includeTimeField: mode === ReduceTransformerMode.ReduceFields ? !!options.includeTimeField : false }));
    }, [onChange, options]);
    var onToggleTime = useCallback(function () {
        onChange(__assign(__assign({}, options), { includeTimeField: !options.includeTimeField }));
    }, [onChange, options]);
    var onToggleLabels = useCallback(function () {
        onChange(__assign(__assign({}, options), { labelsToFields: !options.labelsToFields }));
    }, [onChange, options]);
    return (React.createElement(React.Fragment, null,
        React.createElement("div", null,
            React.createElement("div", { className: "gf-form gf-form--grow" },
                React.createElement("div", { className: "gf-form-label width-8", "aria-label": selectors.components.Transforms.Reduce.modeLabel }, "Mode"),
                React.createElement(Select, { menuShouldPortal: true, options: modes, value: modes.find(function (v) { return v.value === options.mode; }) || modes[0], onChange: onSelectMode, className: "flex-grow-1" }))),
        React.createElement("div", { className: "gf-form-inline" },
            React.createElement("div", { className: "gf-form gf-form--grow" },
                React.createElement("div", { className: "gf-form-label width-8", "aria-label": selectors.components.Transforms.Reduce.calculationsLabel }, "Calculations"),
                React.createElement(StatsPicker, { className: "flex-grow-1", placeholder: "Choose Stat", allowMultiple: true, stats: options.reducers || [], onChange: function (stats) {
                        onChange(__assign(__assign({}, options), { reducers: stats }));
                    } }))),
        options.mode === ReduceTransformerMode.ReduceFields && (React.createElement("div", { className: "gf-form-inline" },
            React.createElement("div", { className: "gf-form" },
                React.createElement(LegacyForms.Switch, { label: "Include time", labelClass: "width-8", checked: !!options.includeTimeField, onChange: onToggleTime })))),
        options.mode !== ReduceTransformerMode.ReduceFields && (React.createElement("div", { className: "gf-form-inline" },
            React.createElement("div", { className: "gf-form" },
                React.createElement(LegacyForms.Switch, { label: "Labels to fields", labelClass: "width-8", checked: !!options.labelsToFields, onChange: onToggleLabels }))))));
};
export var reduceTransformRegistryItem = {
    id: DataTransformerID.reduce,
    editor: ReduceTransformerEditor,
    transformation: standardTransformers.reduceTransformer,
    name: standardTransformers.reduceTransformer.name,
    description: standardTransformers.reduceTransformer.description,
};
//# sourceMappingURL=ReduceTransformerEditor.js.map