import { __assign, __makeTemplateObject } from "tslib";
import React, { useCallback, useMemo } from 'react';
import { InlineField, InlineFieldRow, Select, useStyles2 } from '@grafana/ui';
import { useFieldDisplayNames, useSelectOptions, } from '../../../../../packages/grafana-ui/src/components/MatchersUI/utils';
import { NumberInput } from './NumberInput';
import { css } from '@emotion/css';
import { validateScaleOptions, validateScaleConfig } from '../scale';
var fixedValueOption = {
    label: 'Fixed value',
    value: '_____fixed_____',
};
export var ScaleDimensionEditor = function (props) {
    var value = props.value, context = props.context, onChange = props.onChange, item = props.item;
    var settings = item.settings;
    var styles = useStyles2(getStyles);
    var fieldName = value === null || value === void 0 ? void 0 : value.field;
    var isFixed = Boolean(!fieldName);
    var names = useFieldDisplayNames(context.data);
    var selectOptions = useSelectOptions(names, fieldName, fixedValueOption);
    var minMaxStep = useMemo(function () {
        return validateScaleOptions(settings);
    }, [settings]);
    // Validate and update
    var validateAndDoChange = useCallback(function (v) {
        // always called with a copy so no need to spread
        onChange(validateScaleConfig(v, minMaxStep));
    }, [onChange, minMaxStep]);
    var onSelectChange = useCallback(function (selection) {
        var field = selection.value;
        if (field && field !== fixedValueOption.value) {
            validateAndDoChange(__assign(__assign({}, value), { field: field }));
        }
        else {
            validateAndDoChange(__assign(__assign({}, value), { field: undefined }));
        }
    }, [validateAndDoChange, value]);
    var onMinChange = useCallback(function (min) {
        if (min !== undefined) {
            validateAndDoChange(__assign(__assign({}, value), { min: min }));
        }
    }, [validateAndDoChange, value]);
    var onMaxChange = useCallback(function (max) {
        if (max !== undefined) {
            validateAndDoChange(__assign(__assign({}, value), { max: max }));
        }
    }, [validateAndDoChange, value]);
    var onValueChange = useCallback(function (fixed) {
        if (fixed !== undefined) {
            validateAndDoChange(__assign(__assign({}, value), { fixed: fixed }));
        }
    }, [validateAndDoChange, value]);
    var val = value !== null && value !== void 0 ? value : {};
    var selectedOption = isFixed ? fixedValueOption : selectOptions.find(function (v) { return v.value === fieldName; });
    return (React.createElement(React.Fragment, null,
        React.createElement("div", null,
            React.createElement(Select, { menuShouldPortal: true, value: selectedOption, options: selectOptions, onChange: onSelectChange, noOptionsMessage: "No fields found" })),
        React.createElement("div", { className: styles.range },
            isFixed && (React.createElement(InlineFieldRow, null,
                React.createElement(InlineField, { label: "Value", labelWidth: 8, grow: true },
                    React.createElement(NumberInput, __assign({ value: val.fixed }, minMaxStep, { onChange: onValueChange }))))),
            !isFixed && !minMaxStep.hideRange && (React.createElement(React.Fragment, null,
                React.createElement(InlineFieldRow, null,
                    React.createElement(InlineField, { label: "Min", labelWidth: 8, grow: true },
                        React.createElement(NumberInput, __assign({ value: val.min }, minMaxStep, { onChange: onMinChange })))),
                React.createElement(InlineFieldRow, null,
                    React.createElement(InlineField, { label: "Max", labelWidth: 8, grow: true },
                        React.createElement(NumberInput, __assign({ value: val.max }, minMaxStep, { onChange: onMaxChange })))))))));
};
var getStyles = function (theme) { return ({
    range: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    padding-top: 8px;\n  "], ["\n    padding-top: 8px;\n  "]))),
}); };
var templateObject_1;
//# sourceMappingURL=ScaleDimensionEditor.js.map