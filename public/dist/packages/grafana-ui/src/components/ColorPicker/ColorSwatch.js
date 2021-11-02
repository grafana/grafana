import { __assign, __rest } from "tslib";
import React from 'react';
import tinycolor from 'tinycolor2';
import { useTheme2 } from '../../themes/ThemeContext';
/** @internal */
export var ColorSwatchVariant;
(function (ColorSwatchVariant) {
    ColorSwatchVariant["Small"] = "small";
    ColorSwatchVariant["Large"] = "large";
})(ColorSwatchVariant || (ColorSwatchVariant = {}));
/** @internal */
export var ColorSwatch = React.forwardRef(function (_a, ref) {
    var color = _a.color, label = _a.label, _b = _a.variant, variant = _b === void 0 ? ColorSwatchVariant.Small : _b, isSelected = _a.isSelected, otherProps = __rest(_a, ["color", "label", "variant", "isSelected"]);
    var theme = useTheme2();
    var tc = tinycolor(color);
    var isSmall = variant === ColorSwatchVariant.Small;
    var hasLabel = !!label;
    var swatchSize = isSmall ? '16px' : '32px';
    var swatchStyles = {
        width: swatchSize,
        height: swatchSize,
        borderRadius: '50%',
        background: "" + color,
        marginRight: hasLabel ? '8px' : '0px',
        boxShadow: isSelected
            ? "inset 0 0 0 2px " + color + ", inset 0 0 0 4px " + theme.colors.getContrastText(color)
            : 'none',
    };
    if (tc.getAlpha() < 0.1) {
        swatchStyles.border = "2px solid " + theme.colors.border.medium;
    }
    return (React.createElement("div", __assign({ ref: ref, style: {
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
        } }, otherProps),
        React.createElement("div", { style: swatchStyles }),
        hasLabel && React.createElement("span", null, label)));
});
ColorSwatch.displayName = 'ColorSwatch';
//# sourceMappingURL=ColorSwatch.js.map