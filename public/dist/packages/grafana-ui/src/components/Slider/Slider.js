import { __read, __spreadArray } from "tslib";
import React, { useState, useCallback } from 'react';
import SliderComponent from 'rc-slider';
import { cx } from '@emotion/css';
import { Global } from '@emotion/react';
import { useTheme2 } from '../../themes/ThemeContext';
import { getStyles } from './styles';
import { Input } from '../Input/Input';
/**
 * @public
 */
export var Slider = function (_a) {
    var min = _a.min, max = _a.max, onChange = _a.onChange, onAfterChange = _a.onAfterChange, _b = _a.orientation, orientation = _b === void 0 ? 'horizontal' : _b, reverse = _a.reverse, step = _a.step, value = _a.value, ariaLabelForHandle = _a.ariaLabelForHandle;
    var isHorizontal = orientation === 'horizontal';
    var theme = useTheme2();
    var styles = getStyles(theme, isHorizontal);
    var SliderWithTooltip = SliderComponent;
    var _c = __read(useState(value || min), 2), sliderValue = _c[0], setSliderValue = _c[1];
    var onSliderChange = useCallback(function (v) {
        setSliderValue(v);
        if (onChange) {
            onChange(v);
        }
    }, [setSliderValue, onChange]);
    var onSliderInputChange = useCallback(function (e) {
        var v = +e.target.value;
        if (Number.isNaN(v)) {
            v = 0;
        }
        setSliderValue(v);
        if (onChange) {
            onChange(v);
        }
        if (onAfterChange) {
            onAfterChange(v);
        }
    }, [onChange, onAfterChange]);
    // Check for min/max on input blur so user is able to enter
    // custom values that might seem above/below min/max on first keystroke
    var onSliderInputBlur = useCallback(function (e) {
        var v = +e.target.value;
        if (v > max) {
            setSliderValue(max);
        }
        else if (v < min) {
            setSliderValue(min);
        }
    }, [max, min]);
    var sliderInputClassNames = !isHorizontal ? [styles.sliderInputVertical] : [];
    var sliderInputFieldClassNames = !isHorizontal ? [styles.sliderInputFieldVertical] : [];
    return (React.createElement("div", { className: cx(styles.container, styles.slider) },
        React.createElement(Global, { styles: styles.tooltip }),
        React.createElement("label", { className: cx.apply(void 0, __spreadArray([styles.sliderInput], __read(sliderInputClassNames), false)) },
            React.createElement(SliderWithTooltip, { min: min, max: max, step: step, defaultValue: value, value: sliderValue, onChange: onSliderChange, onAfterChange: onAfterChange, vertical: !isHorizontal, reverse: reverse, ariaLabelForHandle: ariaLabelForHandle }),
            React.createElement(Input, { type: "text", className: cx.apply(void 0, __spreadArray([styles.sliderInputField], __read(sliderInputFieldClassNames), false)), value: "" + sliderValue, onChange: onSliderInputChange, onBlur: onSliderInputBlur, min: min, max: max }))));
};
Slider.displayName = 'Slider';
//# sourceMappingURL=Slider.js.map