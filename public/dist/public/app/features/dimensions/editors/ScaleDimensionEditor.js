import { css } from '@emotion/css';
import React, { useCallback, useMemo } from 'react';
import { InlineField, InlineFieldRow, Select, useStyles2 } from '@grafana/ui';
import { useFieldDisplayNames, useSelectOptions } from '@grafana/ui/src/components/MatchersUI/utils';
import { NumberInput } from 'app/core/components/OptionsUI/NumberInput';
import { validateScaleOptions, validateScaleConfig } from '../scale';
const fixedValueOption = {
    label: 'Fixed value',
    value: '_____fixed_____',
};
export const ScaleDimensionEditor = (props) => {
    const { value, context, onChange, item } = props;
    const { settings } = item;
    const styles = useStyles2(getStyles);
    const fieldName = value === null || value === void 0 ? void 0 : value.field;
    const isFixed = Boolean(!fieldName);
    const names = useFieldDisplayNames(context.data);
    const selectOptions = useSelectOptions(names, fieldName, fixedValueOption);
    const minMaxStep = useMemo(() => {
        return validateScaleOptions(settings);
    }, [settings]);
    // Validate and update
    const validateAndDoChange = useCallback((v) => {
        // always called with a copy so no need to spread
        onChange(validateScaleConfig(v, minMaxStep));
    }, [onChange, minMaxStep]);
    const onSelectChange = useCallback((selection) => {
        const field = selection.value;
        if (field && field !== fixedValueOption.value) {
            validateAndDoChange(Object.assign(Object.assign({}, value), { field }));
        }
        else {
            validateAndDoChange(Object.assign(Object.assign({}, value), { field: undefined }));
        }
    }, [validateAndDoChange, value]);
    const onMinChange = useCallback((min) => {
        if (min !== undefined) {
            validateAndDoChange(Object.assign(Object.assign({}, value), { min }));
        }
    }, [validateAndDoChange, value]);
    const onMaxChange = useCallback((max) => {
        if (max !== undefined) {
            validateAndDoChange(Object.assign(Object.assign({}, value), { max }));
        }
    }, [validateAndDoChange, value]);
    const onValueChange = useCallback((fixed) => {
        if (fixed !== undefined) {
            validateAndDoChange(Object.assign(Object.assign({}, value), { fixed }));
        }
    }, [validateAndDoChange, value]);
    const val = value !== null && value !== void 0 ? value : {};
    const selectedOption = isFixed ? fixedValueOption : selectOptions.find((v) => v.value === fieldName);
    return (React.createElement(React.Fragment, null,
        React.createElement("div", null,
            React.createElement(Select, { value: selectedOption, options: selectOptions, onChange: onSelectChange, noOptionsMessage: "No fields found" })),
        React.createElement("div", { className: styles.range },
            isFixed && (React.createElement(InlineFieldRow, null,
                React.createElement(InlineField, { label: "Value", labelWidth: 8, grow: true },
                    React.createElement(NumberInput, Object.assign({ value: val.fixed }, minMaxStep, { onChange: onValueChange }))))),
            !isFixed && !minMaxStep.hideRange && (React.createElement(React.Fragment, null,
                React.createElement(InlineFieldRow, null,
                    React.createElement(InlineField, { label: "Min", labelWidth: 8, grow: true },
                        React.createElement(NumberInput, Object.assign({ value: val.min }, minMaxStep, { onChange: onMinChange })))),
                React.createElement(InlineFieldRow, null,
                    React.createElement(InlineField, { label: "Max", labelWidth: 8, grow: true },
                        React.createElement(NumberInput, Object.assign({ value: val.max }, minMaxStep, { onChange: onMaxChange })))))))));
};
const getStyles = (theme) => ({
    range: css `
    padding-top: 8px;
  `,
});
//# sourceMappingURL=ScaleDimensionEditor.js.map