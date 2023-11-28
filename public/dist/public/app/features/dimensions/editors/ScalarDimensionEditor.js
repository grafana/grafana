import { css } from '@emotion/css';
import React, { useCallback } from 'react';
import { FieldType } from '@grafana/data';
import { ScalarDimensionMode } from '@grafana/schema';
import { InlineField, InlineFieldRow, RadioButtonGroup, Select, useStyles2 } from '@grafana/ui';
import { useFieldDisplayNames, useSelectOptions } from '@grafana/ui/src/components/MatchersUI/utils';
import { NumberInput } from 'app/core/components/OptionsUI/NumberInput';
const fixedValueOption = {
    label: 'Fixed value',
    value: '_____fixed_____',
};
const scalarOptions = [
    { label: 'Mod', value: ScalarDimensionMode.Mod, description: 'Use field values, mod from max' },
    { label: 'Clamped', value: ScalarDimensionMode.Clamped, description: 'Use field values, clamped to max and min' },
];
export const ScalarDimensionEditor = ({ value, context, onChange, item }) => {
    var _a, _b;
    const { settings } = item;
    const DEFAULT_VALUE = 0;
    const fieldName = value === null || value === void 0 ? void 0 : value.field;
    const isFixed = Boolean(!fieldName);
    const names = useFieldDisplayNames(context.data);
    const selectOptions = useSelectOptions(names, fieldName, fixedValueOption, FieldType.number);
    const styles = useStyles2(getStyles);
    const onSelectChange = useCallback((selection) => {
        var _a;
        const field = selection.value;
        if (field && field !== fixedValueOption.value) {
            onChange(Object.assign(Object.assign({}, value), { field }));
        }
        else {
            const fixed = (_a = value.fixed) !== null && _a !== void 0 ? _a : DEFAULT_VALUE;
            onChange(Object.assign(Object.assign({}, value), { field: undefined, fixed }));
        }
    }, [onChange, value]);
    const onModeChange = useCallback((mode) => {
        onChange(Object.assign(Object.assign({}, value), { mode }));
    }, [onChange, value]);
    const onValueChange = useCallback((v) => {
        onChange(Object.assign(Object.assign({}, value), { field: undefined, fixed: v !== null && v !== void 0 ? v : DEFAULT_VALUE }));
    }, [onChange, value]);
    const val = value !== null && value !== void 0 ? value : {};
    const mode = (_a = value === null || value === void 0 ? void 0 : value.mode) !== null && _a !== void 0 ? _a : ScalarDimensionMode.Mod;
    const selectedOption = isFixed ? fixedValueOption : selectOptions.find((v) => v.value === fieldName);
    return (React.createElement(React.Fragment, null,
        React.createElement("div", null,
            React.createElement(InlineFieldRow, null,
                React.createElement(InlineField, { label: "Limit", labelWidth: 8, grow: true },
                    React.createElement(RadioButtonGroup, { value: mode, options: scalarOptions, onChange: onModeChange, fullWidth: true }))),
            React.createElement(Select, { value: selectedOption, options: selectOptions, onChange: onSelectChange, noOptionsMessage: "No fields found" })),
        React.createElement("div", { className: styles.range }, isFixed && (React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Value", labelWidth: 8, grow: true },
                React.createElement(NumberInput, { value: (_b = val === null || val === void 0 ? void 0 : val.fixed) !== null && _b !== void 0 ? _b : DEFAULT_VALUE, onChange: onValueChange, max: settings === null || settings === void 0 ? void 0 : settings.max, min: settings === null || settings === void 0 ? void 0 : settings.min })))))));
};
const getStyles = (theme) => ({
    range: css `
    padding-top: 8px;
  `,
});
//# sourceMappingURL=ScalarDimensionEditor.js.map