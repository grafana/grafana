import { css, cx } from '@emotion/css';
import { Global } from '@emotion/react';
import Slider from 'rc-slider';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTheme2 } from '@grafana/ui';
import { getStyles } from '@grafana/ui/src/components/Slider/styles';
import { NumberInput } from './NumberInput';
export const SliderValueEditor = ({ value, onChange, item }) => {
    // Input reference
    const inputRef = useRef(null);
    // Settings
    const { settings } = item;
    const min = (settings === null || settings === void 0 ? void 0 : settings.min) || 0;
    const max = (settings === null || settings === void 0 ? void 0 : settings.max) || 100;
    const step = settings === null || settings === void 0 ? void 0 : settings.step;
    const marks = (settings === null || settings === void 0 ? void 0 : settings.marks) || { [min]: min, [max]: max };
    const included = settings === null || settings === void 0 ? void 0 : settings.included;
    const ariaLabelForHandle = settings === null || settings === void 0 ? void 0 : settings.ariaLabelForHandle;
    // Core slider specific parameters and state
    const inputWidthDefault = 75;
    const isHorizontal = true;
    const theme = useTheme2();
    const [sliderValue, setSliderValue] = useState(value !== null && value !== void 0 ? value : min);
    const [inputWidth, setInputWidth] = useState(inputWidthDefault);
    // Check for a difference between prop value and internal state
    useEffect(() => {
        if (value != null && value !== sliderValue) {
            setSliderValue(value);
        }
    }, [value, sliderValue]);
    // Using input font and expected maximum number of digits, set input width
    useEffect(() => {
        const inputElement = getComputedStyle(inputRef.current);
        const fontWeight = inputElement.getPropertyValue('font-weight') || 'normal';
        const fontSize = inputElement.getPropertyValue('font-size') || '16px';
        const fontFamily = inputElement.getPropertyValue('font-family') || 'Arial';
        const wideNumericalCharacter = '0';
        const marginDigits = 4; // extra digits to account for things like negative, exponential, and controls
        const inputPadding = 8; // TODO: base this on input styling
        const maxDigits = Math.max((max + (step || 0)).toString().length, (max - (step || 0)).toString().length) + marginDigits;
        const refString = wideNumericalCharacter.repeat(maxDigits);
        const calculatedTextWidth = getTextWidth(refString, `${fontWeight} ${fontSize} ${fontFamily}`);
        if (calculatedTextWidth) {
            setInputWidth(calculatedTextWidth + inputPadding * 2);
        }
    }, [max, step]);
    const onSliderChange = useCallback((v) => {
        const value = typeof v === 'number' ? v : v[0];
        setSliderValue(value);
        if (onChange) {
            onChange(value);
        }
    }, [setSliderValue, onChange]);
    const onSliderInputChange = useCallback((value) => {
        let v = value;
        if (Number.isNaN(v) || !v) {
            v = 0;
        }
        setSliderValue(v);
        if (onChange) {
            onChange(v);
        }
    }, [onChange]);
    // Styles
    const styles = getStyles(theme, isHorizontal, Boolean(marks));
    const stylesSlider = getStylesSlider(theme, inputWidth);
    const sliderInputClassNames = !isHorizontal ? [styles.sliderInputVertical] : [];
    return (React.createElement("div", { className: cx(styles.container, styles.slider) },
        React.createElement(Global, { styles: styles.slider }),
        React.createElement("label", { className: cx(styles.sliderInput, ...sliderInputClassNames) },
            React.createElement(Slider, { min: min, max: max, step: step, defaultValue: value, value: sliderValue, onChange: onSliderChange, vertical: !isHorizontal, reverse: false, ariaLabelForHandle: ariaLabelForHandle, marks: marks, included: included }),
            React.createElement("span", { className: stylesSlider.numberInputWrapper, ref: inputRef },
                React.createElement(NumberInput, { value: sliderValue, onChange: onSliderInputChange, max: max, min: min, step: step })))));
};
// Calculate width of string with given font
function getTextWidth(text, font) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (context) {
        context.font = font;
        const metrics = context.measureText(text);
        return metrics.width;
    }
    return null;
}
const getStylesSlider = (theme, width) => {
    return {
        numberInputWrapper: css `
      margin-left: ${theme.spacing(3)};
      max-height: 32px;
      max-width: ${width}px;
      min-width: ${width}px;
      overflow: visible;
      width: 100%;
    `,
    };
};
//# sourceMappingURL=slider.js.map