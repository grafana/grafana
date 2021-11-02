import React from 'react';
import { Range as RangeComponent, createSliderWithTooltip } from 'rc-slider';
import { cx } from '@emotion/css';
import { Global } from '@emotion/react';
import { useTheme2 } from '../../themes/ThemeContext';
import { getStyles } from './styles';
/**
 * @public
 *
 * RichHistoryQueriesTab uses this Range Component
 */
export var RangeSlider = function (_a) {
    var min = _a.min, max = _a.max, onChange = _a.onChange, onAfterChange = _a.onAfterChange, _b = _a.orientation, orientation = _b === void 0 ? 'horizontal' : _b, reverse = _a.reverse, step = _a.step, formatTooltipResult = _a.formatTooltipResult, value = _a.value, _c = _a.tooltipAlwaysVisible, tooltipAlwaysVisible = _c === void 0 ? true : _c;
    var isHorizontal = orientation === 'horizontal';
    var theme = useTheme2();
    var styles = getStyles(theme, isHorizontal);
    var RangeWithTooltip = createSliderWithTooltip(RangeComponent);
    return (React.createElement("div", { className: cx(styles.container, styles.slider) },
        React.createElement(Global, { styles: styles.tooltip }),
        React.createElement(RangeWithTooltip, { tipProps: {
                visible: tooltipAlwaysVisible,
                placement: isHorizontal ? 'top' : 'right',
            }, min: min, max: max, step: step, defaultValue: value, tipFormatter: function (value) { return (formatTooltipResult ? formatTooltipResult(value) : value); }, onChange: onChange, onAfterChange: onAfterChange, vertical: !isHorizontal, reverse: reverse })));
};
RangeSlider.displayName = 'Range';
//# sourceMappingURL=RangeSlider.js.map