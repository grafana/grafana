import { __read } from "tslib";
import React from 'react';
import { cx } from '@emotion/css';
import { Input } from '@grafana/ui';
import { useShadowedState } from '../useShadowedState';
import { paddingRightClass } from './styles';
export var InputSection = function (_a) {
    var value = _a.value, onChange = _a.onChange, isWide = _a.isWide, placeholder = _a.placeholder;
    var _b = __read(useShadowedState(value), 2), currentValue = _b[0], setCurrentValue = _b[1];
    var onBlur = function () {
        // we send empty-string as undefined
        var newValue = currentValue === '' ? undefined : currentValue;
        onChange(newValue);
    };
    return (React.createElement(React.Fragment, null,
        React.createElement(Input, { placeholder: placeholder, className: cx((isWide !== null && isWide !== void 0 ? isWide : false) ? 'width-14' : 'width-8', paddingRightClass), type: "text", spellCheck: false, onBlur: onBlur, onChange: function (e) {
                setCurrentValue(e.currentTarget.value);
            }, value: currentValue !== null && currentValue !== void 0 ? currentValue : '' })));
};
//# sourceMappingURL=InputSection.js.map