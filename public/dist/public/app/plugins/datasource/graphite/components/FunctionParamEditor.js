import { __makeTemplateObject } from "tslib";
import React from 'react';
import { Segment, SegmentInput, useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';
/**
 * Render a function parameter with a segment dropdown for multiple options or simple input.
 */
export function FunctionParamEditor(_a) {
    var _b;
    var editableParam = _a.editableParam, onChange = _a.onChange, onExpandedChange = _a.onExpandedChange, autofocus = _a.autofocus;
    var styles = useStyles2(getStyles);
    if (((_b = editableParam.options) === null || _b === void 0 ? void 0 : _b.length) > 0) {
        return (React.createElement(Segment, { autofocus: autofocus, value: editableParam.value, inputPlaceholder: editableParam.name, className: styles.segment, options: editableParam.options, placeholder: ' +' + editableParam.name, onChange: function (value) {
                onChange(value.value || '');
            }, onExpandedChange: onExpandedChange, inputMinWidth: 150, allowCustomValue: true, allowEmptyValue: true }));
    }
    else {
        return (React.createElement(SegmentInput, { autofocus: autofocus, className: styles.input, value: editableParam.value || '', placeholder: ' +' + editableParam.name, inputPlaceholder: editableParam.name, onChange: function (value) {
                onChange(value.toString());
            }, onExpandedChange: onExpandedChange, 
            // input style
            style: { height: '25px', paddingTop: '2px', marginTop: '2px', paddingLeft: '4px', minWidth: '100px' } }));
    }
}
var getStyles = function (theme) { return ({
    segment: css({
        margin: 0,
        padding: 0,
    }),
    input: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    margin: 0;\n    padding: 0;\n    input {\n      height: 25px;\n    },\n  "], ["\n    margin: 0;\n    padding: 0;\n    input {\n      height: 25px;\n    },\n  "]))),
}); };
var templateObject_1;
//# sourceMappingURL=FunctionParamEditor.js.map