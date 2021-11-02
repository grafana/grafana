import { __assign } from "tslib";
import React from 'react';
import { FieldType, identityOverrideProcessor, } from '@grafana/data';
import { graphFieldOptions, Select, HorizontalGroup, RadioButtonGroup } from '../../index';
import { AxisPlacement, ScaleDistribution } from '@grafana/schema';
/**
 * @alpha
 */
export function addAxisConfig(builder, defaultConfig, hideScale) {
    var category = ['Axis'];
    builder
        .addRadio({
        path: 'axisPlacement',
        name: 'Placement',
        category: category,
        defaultValue: graphFieldOptions.axisPlacement[0].value,
        settings: {
            options: graphFieldOptions.axisPlacement,
        },
    })
        .addTextInput({
        path: 'axisLabel',
        name: 'Label',
        category: category,
        defaultValue: '',
        settings: {
            placeholder: 'Optional text',
        },
        showIf: function (c) { return c.axisPlacement !== AxisPlacement.Hidden; },
        // no matter what the field type is
        shouldApply: function () { return true; },
    })
        .addNumberInput({
        path: 'axisWidth',
        name: 'Width',
        category: category,
        settings: {
            placeholder: 'Auto',
        },
        showIf: function (c) { return c.axisPlacement !== AxisPlacement.Hidden; },
    })
        .addNumberInput({
        path: 'axisSoftMin',
        name: 'Soft min',
        defaultValue: defaultConfig.axisSoftMin,
        category: category,
        settings: {
            placeholder: 'See: Standard options > Min',
        },
    })
        .addNumberInput({
        path: 'axisSoftMax',
        name: 'Soft max',
        defaultValue: defaultConfig.axisSoftMax,
        category: category,
        settings: {
            placeholder: 'See: Standard options > Max',
        },
    })
        .addRadio({
        path: 'axisGridShow',
        name: 'Show grid lines',
        category: category,
        defaultValue: undefined,
        settings: {
            options: [
                { value: undefined, label: 'Auto' },
                { value: true, label: 'On' },
                { value: false, label: 'Off' },
            ],
        },
    });
    if (!hideScale) {
        builder.addCustomEditor({
            id: 'scaleDistribution',
            path: 'scaleDistribution',
            name: 'Scale',
            category: category,
            editor: ScaleDistributionEditor,
            override: ScaleDistributionEditor,
            defaultValue: { type: ScaleDistribution.Linear },
            shouldApply: function (f) { return f.type === FieldType.number; },
            process: identityOverrideProcessor,
        });
    }
}
var DISTRIBUTION_OPTIONS = [
    {
        label: 'Linear',
        value: ScaleDistribution.Linear,
    },
    {
        label: 'Logarithmic',
        value: ScaleDistribution.Log,
    },
];
var LOG_DISTRIBUTION_OPTIONS = [
    {
        label: '2',
        value: 2,
    },
    {
        label: '10',
        value: 10,
    },
];
/**
 * @alpha
 */
var ScaleDistributionEditor = function (_a) {
    var value = _a.value, onChange = _a.onChange;
    return (React.createElement(HorizontalGroup, null,
        React.createElement(RadioButtonGroup, { value: value.type || ScaleDistribution.Linear, options: DISTRIBUTION_OPTIONS, onChange: function (v) {
                console.log(v, value);
                onChange(__assign(__assign({}, value), { type: v, log: v === ScaleDistribution.Linear ? undefined : 2 }));
            } }),
        value.type === ScaleDistribution.Log && (React.createElement(Select, { menuShouldPortal: true, allowCustomValue: false, autoFocus: true, options: LOG_DISTRIBUTION_OPTIONS, value: value.log || 2, prefix: 'base', width: 12, onChange: function (v) {
                onChange(__assign(__assign({}, value), { log: v.value }));
            } }))));
};
//# sourceMappingURL=axis.js.map