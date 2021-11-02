import { __makeTemplateObject } from "tslib";
import React, { useCallback } from 'react';
import { InlineField, TextArea, useStyles } from '@grafana/ui';
import { css } from '@emotion/css';
export function VariableTextAreaField(_a) {
    var name = _a.name, value = _a.value, placeholder = _a.placeholder, tooltip = _a.tooltip, onChange = _a.onChange, onBlur = _a.onBlur, ariaLabel = _a.ariaLabel, required = _a.required, width = _a.width, labelWidth = _a.labelWidth;
    var styles = useStyles(getStyles);
    var getLineCount = useCallback(function (value) {
        if (value && typeof value === 'string') {
            return value.split('\n').length;
        }
        return 1;
    }, []);
    return (React.createElement(InlineField, { label: name, labelWidth: labelWidth !== null && labelWidth !== void 0 ? labelWidth : 12, tooltip: tooltip },
        React.createElement(TextArea, { rows: getLineCount(value), value: value, onChange: onChange, onBlur: onBlur, placeholder: placeholder, required: required, "aria-label": ariaLabel, cols: width, className: styles.textarea })));
}
function getStyles(theme) {
    return {
        textarea: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      white-space: pre-wrap;\n      min-height: 32px;\n      height: auto;\n      overflow: auto;\n      padding: 6px 8px;\n    "], ["\n      white-space: pre-wrap;\n      min-height: 32px;\n      height: auto;\n      overflow: auto;\n      padding: 6px 8px;\n    "]))),
    };
}
var templateObject_1;
//# sourceMappingURL=VariableTextAreaField.js.map