import { __assign, __makeTemplateObject } from "tslib";
import React, { useCallback } from 'react';
import { Select, ColorPicker, useStyles2 } from '@grafana/ui';
import { useFieldDisplayNames, useSelectOptions, } from '../../../../../packages/grafana-ui/src/components/MatchersUI/utils';
import { css } from '@emotion/css';
var fixedColorOption = {
    label: 'Fixed color',
    value: '_____fixed_____',
};
export var ColorDimensionEditor = function (props) {
    var _a;
    var value = props.value, context = props.context, onChange = props.onChange;
    var defaultColor = 'dark-green';
    var styles = useStyles2(getStyles);
    var fieldName = value === null || value === void 0 ? void 0 : value.field;
    var isFixed = Boolean(!fieldName);
    var names = useFieldDisplayNames(context.data);
    var selectOptions = useSelectOptions(names, fieldName, fixedColorOption);
    var onSelectChange = useCallback(function (selection) {
        var _a;
        var field = selection.value;
        if (field && field !== fixedColorOption.value) {
            onChange(__assign(__assign({}, value), { field: field }));
        }
        else {
            var fixed = (_a = value.fixed) !== null && _a !== void 0 ? _a : defaultColor;
            onChange(__assign(__assign({}, value), { field: undefined, fixed: fixed }));
        }
    }, [onChange, value]);
    var onColorChange = useCallback(function (c) {
        onChange({
            field: undefined,
            fixed: c !== null && c !== void 0 ? c : defaultColor,
        });
    }, [onChange]);
    var selectedOption = isFixed ? fixedColorOption : selectOptions.find(function (v) { return v.value === fieldName; });
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { className: styles.container },
            React.createElement(Select, { menuShouldPortal: true, value: selectedOption, options: selectOptions, onChange: onSelectChange, noOptionsMessage: "No fields found" }),
            isFixed && (React.createElement("div", { className: styles.picker },
                React.createElement(ColorPicker, { color: (_a = value === null || value === void 0 ? void 0 : value.fixed) !== null && _a !== void 0 ? _a : defaultColor, onChange: onColorChange, enableNamedColors: true }))))));
};
var getStyles = function (theme) { return ({
    container: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    display: flex;\n    flex-wrap: nowrap;\n    justify-content: flex-end;\n    align-items: center;\n  "], ["\n    display: flex;\n    flex-wrap: nowrap;\n    justify-content: flex-end;\n    align-items: center;\n  "]))),
    picker: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    padding-left: 8px;\n  "], ["\n    padding-left: 8px;\n  "]))),
}); };
var templateObject_1, templateObject_2;
//# sourceMappingURL=ColorDimensionEditor.js.map