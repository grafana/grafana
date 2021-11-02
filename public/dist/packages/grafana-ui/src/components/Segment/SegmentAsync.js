import { __assign, __read, __rest } from "tslib";
import React from 'react';
import { cx } from '@emotion/css';
import { isObject } from 'lodash';
import { SegmentSelect } from './SegmentSelect';
import { useExpandableLabel } from '.';
import { useAsyncFn } from 'react-use';
import { getSegmentStyles } from './styles';
import { InlineLabel } from '../Forms/InlineLabel';
import { useStyles } from '../../themes';
export function SegmentAsync(_a) {
    var _b;
    var _c;
    var value = _a.value, onChange = _a.onChange, loadOptions = _a.loadOptions, _d = _a.reloadOptionsOnChange, reloadOptionsOnChange = _d === void 0 ? false : _d, Component = _a.Component, className = _a.className, allowCustomValue = _a.allowCustomValue, allowEmptyValue = _a.allowEmptyValue, disabled = _a.disabled, placeholder = _a.placeholder, inputMinWidth = _a.inputMinWidth, inputPlaceholder = _a.inputPlaceholder, _e = _a.autofocus, autofocus = _e === void 0 ? false : _e, onExpandedChange = _a.onExpandedChange, _f = _a.noOptionMessageHandler, noOptionMessageHandler = _f === void 0 ? mapStateToNoOptionsMessage : _f, rest = __rest(_a, ["value", "onChange", "loadOptions", "reloadOptionsOnChange", "Component", "className", "allowCustomValue", "allowEmptyValue", "disabled", "placeholder", "inputMinWidth", "inputPlaceholder", "autofocus", "onExpandedChange", "noOptionMessageHandler"]);
    var _g = __read(useAsyncFn(loadOptions, [loadOptions]), 2), state = _g[0], fetchOptions = _g[1];
    var _h = __read(useExpandableLabel(autofocus, onExpandedChange), 4), Label = _h[0], labelWidth = _h[1], expanded = _h[2], setExpanded = _h[3];
    var width = inputMinWidth ? Math.max(inputMinWidth, labelWidth) : labelWidth;
    var styles = useStyles(getSegmentStyles);
    if (!expanded) {
        var label = isObject(value) ? value.label : value;
        return (React.createElement(Label, { onClick: reloadOptionsOnChange ? undefined : fetchOptions, disabled: disabled, Component: Component || (React.createElement(InlineLabel, { className: cx(styles.segment, (_b = {},
                    _b[styles.queryPlaceholder] = placeholder !== undefined && !value,
                    _b[styles.disabled] = disabled,
                    _b), className) }, label || placeholder)) }));
    }
    return (React.createElement(SegmentSelect, __assign({}, rest, { value: value && !isObject(value) ? { value: value } : value, placeholder: inputPlaceholder, options: (_c = state.value) !== null && _c !== void 0 ? _c : [], loadOptions: reloadOptionsOnChange ? fetchOptions : undefined, width: width, noOptionsMessage: noOptionMessageHandler(state), allowCustomValue: allowCustomValue, allowEmptyValue: allowEmptyValue, onClickOutside: function () {
            setExpanded(false);
        }, onChange: function (item) {
            setExpanded(false);
            onChange(item);
        } })));
}
function mapStateToNoOptionsMessage(state) {
    if (state.loading) {
        return 'Loading options...';
    }
    if (state.error) {
        return 'Failed to load options';
    }
    if (!Array.isArray(state.value) || state.value.length === 0) {
        return 'No options found';
    }
    return '';
}
//# sourceMappingURL=SegmentAsync.js.map