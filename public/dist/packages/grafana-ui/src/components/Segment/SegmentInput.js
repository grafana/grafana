import { __assign, __makeTemplateObject, __read, __rest } from "tslib";
import React, { useRef, useState } from 'react';
import { cx, css } from '@emotion/css';
import useClickAway from 'react-use/lib/useClickAway';
import { measureText } from '../../utils/measureText';
import { useExpandableLabel } from '.';
import { getSegmentStyles } from './styles';
import { InlineLabel } from '../Forms/InlineLabel';
import { useStyles } from '../../themes';
var FONT_SIZE = 14;
export function SegmentInput(_a) {
    var _b;
    var initialValue = _a.value, onChange = _a.onChange, Component = _a.Component, className = _a.className, placeholder = _a.placeholder, inputPlaceholder = _a.inputPlaceholder, disabled = _a.disabled, _c = _a.autofocus, autofocus = _c === void 0 ? false : _c, onExpandedChange = _a.onExpandedChange, rest = __rest(_a, ["value", "onChange", "Component", "className", "placeholder", "inputPlaceholder", "disabled", "autofocus", "onExpandedChange"]);
    var ref = useRef(null);
    var _d = __read(useState(initialValue), 2), value = _d[0], setValue = _d[1];
    var _e = __read(useState(measureText((initialValue || '').toString(), FONT_SIZE).width), 2), inputWidth = _e[0], setInputWidth = _e[1];
    var _f = __read(useExpandableLabel(autofocus, onExpandedChange), 4), Label = _f[0], expanded = _f[2], setExpanded = _f[3];
    var styles = useStyles(getSegmentStyles);
    useClickAway(ref, function () {
        setExpanded(false);
        onChange(value);
    });
    if (!expanded) {
        return (React.createElement(Label, { disabled: disabled, Component: Component || (React.createElement(InlineLabel, { className: cx(styles.segment, (_b = {},
                    _b[styles.queryPlaceholder] = placeholder !== undefined && !value,
                    _b[styles.disabled] = disabled,
                    _b), className) }, initialValue || placeholder)) }));
    }
    var inputWidthStyle = css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    width: ", "px;\n  "], ["\n    width: ", "px;\n  "])), Math.max(inputWidth + 20, 32));
    return (React.createElement("input", __assign({}, rest, { ref: ref, autoFocus: true, className: cx("gf-form gf-form-input", inputWidthStyle), value: value, placeholder: inputPlaceholder, onChange: function (item) {
            var width = measureText(item.target.value, FONT_SIZE).width;
            setInputWidth(width);
            setValue(item.target.value);
        }, onBlur: function () {
            setExpanded(false);
            onChange(value);
        }, onKeyDown: function (e) {
            if ([13, 27].includes(e.keyCode)) {
                setExpanded(false);
                onChange(value);
            }
        } })));
}
var templateObject_1;
//# sourceMappingURL=SegmentInput.js.map