import { __assign, __read, __rest } from "tslib";
import React from 'react';
import { cx } from '@emotion/css';
import { isObject } from 'lodash';
import { SegmentSelect, useExpandableLabel } from './';
import { getSegmentStyles } from './styles';
import { InlineLabel } from '../Forms/InlineLabel';
import { useStyles } from '../../themes';
export function Segment(_a) {
    var _b;
    var options = _a.options, value = _a.value, onChange = _a.onChange, Component = _a.Component, className = _a.className, allowCustomValue = _a.allowCustomValue, allowEmptyValue = _a.allowEmptyValue, placeholder = _a.placeholder, disabled = _a.disabled, inputMinWidth = _a.inputMinWidth, inputPlaceholder = _a.inputPlaceholder, onExpandedChange = _a.onExpandedChange, _c = _a.autofocus, autofocus = _c === void 0 ? false : _c, rest = __rest(_a, ["options", "value", "onChange", "Component", "className", "allowCustomValue", "allowEmptyValue", "placeholder", "disabled", "inputMinWidth", "inputPlaceholder", "onExpandedChange", "autofocus"]);
    var _d = __read(useExpandableLabel(autofocus, onExpandedChange), 4), Label = _d[0], labelWidth = _d[1], expanded = _d[2], setExpanded = _d[3];
    var width = inputMinWidth ? Math.max(inputMinWidth, labelWidth) : labelWidth;
    var styles = useStyles(getSegmentStyles);
    if (!expanded) {
        var label = isObject(value) ? value.label : value;
        return (React.createElement(Label, { disabled: disabled, Component: Component || (React.createElement(InlineLabel, { className: cx(styles.segment, (_b = {},
                    _b[styles.queryPlaceholder] = placeholder !== undefined && !value,
                    _b[styles.disabled] = disabled,
                    _b), className) }, label || placeholder)) }));
    }
    return (React.createElement(SegmentSelect, __assign({}, rest, { value: value && !isObject(value) ? { value: value } : value, placeholder: inputPlaceholder, options: options, width: width, onClickOutside: function () { return setExpanded(false); }, allowCustomValue: allowCustomValue, allowEmptyValue: allowEmptyValue, onChange: function (item) {
            setExpanded(false);
            onChange(item);
        } })));
}
//# sourceMappingURL=Segment.js.map