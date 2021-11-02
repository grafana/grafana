import { __assign, __makeTemplateObject, __rest } from "tslib";
import React from 'react';
import { Label } from './Label';
import { stylesFactory, useTheme2 } from '../../themes';
import { css, cx } from '@emotion/css';
import { FieldValidationMessage } from './FieldValidationMessage';
import { getChildId } from '../../utils/children';
export var getFieldStyles = stylesFactory(function (theme) {
    return {
        field: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      display: flex;\n      flex-direction: column;\n      margin-bottom: ", ";\n    "], ["\n      display: flex;\n      flex-direction: column;\n      margin-bottom: ", ";\n    "])), theme.spacing(2)),
        fieldHorizontal: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      flex-direction: row;\n      justify-content: space-between;\n      flex-wrap: wrap;\n    "], ["\n      flex-direction: row;\n      justify-content: space-between;\n      flex-wrap: wrap;\n    "]))),
        fieldValidationWrapper: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      margin-top: ", ";\n    "], ["\n      margin-top: ", ";\n    "])), theme.spacing(0.5)),
        fieldValidationWrapperHorizontal: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      flex: 1 1 100%;\n    "], ["\n      flex: 1 1 100%;\n    "]))),
        validationMessageHorizontalOverflow: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      width: 0;\n      overflow-x: visible;\n\n      & > * {\n        white-space: nowrap;\n      }\n    "], ["\n      width: 0;\n      overflow-x: visible;\n\n      & > * {\n        white-space: nowrap;\n      }\n    "]))),
    };
});
export var Field = function (_a) {
    var _b, _c;
    var label = _a.label, description = _a.description, horizontal = _a.horizontal, invalid = _a.invalid, loading = _a.loading, disabled = _a.disabled, required = _a.required, error = _a.error, children = _a.children, className = _a.className, validationMessageHorizontalOverflow = _a.validationMessageHorizontalOverflow, htmlFor = _a.htmlFor, otherProps = __rest(_a, ["label", "description", "horizontal", "invalid", "loading", "disabled", "required", "error", "children", "className", "validationMessageHorizontalOverflow", "htmlFor"]);
    var theme = useTheme2();
    var styles = getFieldStyles(theme);
    var inputId = htmlFor !== null && htmlFor !== void 0 ? htmlFor : getChildId(children);
    var labelElement = typeof label === 'string' ? (React.createElement(Label, { htmlFor: inputId, description: description }, "" + label + (required ? ' *' : ''))) : (label);
    return (React.createElement("div", __assign({ className: cx(styles.field, horizontal && styles.fieldHorizontal, className) }, otherProps),
        labelElement,
        React.createElement("div", null,
            React.cloneElement(children, { invalid: invalid, disabled: disabled, loading: loading }),
            invalid && error && !horizontal && (React.createElement("div", { className: cx(styles.fieldValidationWrapper, (_b = {},
                    _b[styles.validationMessageHorizontalOverflow] = !!validationMessageHorizontalOverflow,
                    _b)) },
                React.createElement(FieldValidationMessage, null, error)))),
        invalid && error && horizontal && (React.createElement("div", { className: cx(styles.fieldValidationWrapper, styles.fieldValidationWrapperHorizontal, (_c = {},
                _c[styles.validationMessageHorizontalOverflow] = !!validationMessageHorizontalOverflow,
                _c)) },
            React.createElement(FieldValidationMessage, null, error)))));
};
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5;
//# sourceMappingURL=Field.js.map