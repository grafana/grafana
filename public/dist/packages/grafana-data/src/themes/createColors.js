import { __assign, __rest } from "tslib";
import { merge } from 'lodash';
import { alpha, darken, emphasize, getContrastRatio, lighten } from './colorManipulator';
import { palette } from './palette';
var DarkColors = /** @class */ (function () {
    function DarkColors() {
        this.mode = 'dark';
        // Used to get more white opacity colors
        this.whiteBase = '204, 204, 220';
        this.border = {
            weak: "rgba(" + this.whiteBase + ", 0.07)",
            medium: "rgba(" + this.whiteBase + ", 0.15)",
            strong: "rgba(" + this.whiteBase + ", 0.25)",
        };
        this.text = {
            primary: "rgb(" + this.whiteBase + ")",
            secondary: "rgba(" + this.whiteBase + ", 0.65)",
            disabled: "rgba(" + this.whiteBase + ", 0.57)",
            link: palette.blueDarkText,
            maxContrast: palette.white,
        };
        this.primary = {
            main: palette.blueDarkMain,
            text: palette.blueDarkText,
            border: palette.blueDarkText,
        };
        this.secondary = {
            main: "rgba(" + this.whiteBase + ", 0.16)",
            shade: "rgba(" + this.whiteBase + ", 0.20)",
            text: this.text.primary,
            contrastText: "rgb(" + this.whiteBase + ")",
            border: this.border.strong,
        };
        this.info = this.primary;
        this.error = {
            main: palette.redDarkMain,
            text: palette.redDarkText,
        };
        this.success = {
            main: palette.greenDarkMain,
            text: palette.greenDarkText,
        };
        this.warning = {
            main: palette.orangeDarkMain,
            text: palette.orangeDarkText,
        };
        this.background = {
            canvas: palette.gray05,
            primary: palette.gray10,
            secondary: palette.gray15,
        };
        this.action = {
            hover: "rgba(" + this.whiteBase + ", 0.16)",
            selected: "rgba(" + this.whiteBase + ", 0.12)",
            focus: "rgba(" + this.whiteBase + ", 0.16)",
            hoverOpacity: 0.08,
            disabledText: this.text.disabled,
            disabledBackground: "rgba(" + this.whiteBase + ", 0.04)",
            disabledOpacity: 0.38,
        };
        this.gradients = {
            brandHorizontal: ' linear-gradient(270deg, #F55F3E 0%, #FF8833 100%);',
            brandVertical: 'linear-gradient(0.01deg, #F55F3E 0.01%, #FF8833 99.99%);',
        };
        this.contrastThreshold = 3;
        this.hoverFactor = 0.03;
        this.tonalOffset = 0.15;
    }
    return DarkColors;
}());
var LightColors = /** @class */ (function () {
    function LightColors() {
        this.mode = 'light';
        this.blackBase = '36, 41, 46';
        this.primary = {
            main: palette.blueLightMain,
            border: palette.blueLightText,
            text: palette.blueLightText,
        };
        this.text = {
            primary: "rgba(" + this.blackBase + ", 1)",
            secondary: "rgba(" + this.blackBase + ", 0.75)",
            disabled: "rgba(" + this.blackBase + ", 0.50)",
            link: this.primary.text,
            maxContrast: palette.black,
        };
        this.border = {
            weak: "rgba(" + this.blackBase + ", 0.12)",
            medium: "rgba(" + this.blackBase + ", 0.30)",
            strong: "rgba(" + this.blackBase + ", 0.40)",
        };
        this.secondary = {
            main: "rgba(" + this.blackBase + ", 0.16)",
            shade: "rgba(" + this.blackBase + ", 0.20)",
            contrastText: "rgba(" + this.blackBase + ",  1)",
            text: this.text.primary,
            border: this.border.strong,
        };
        this.info = {
            main: palette.blueLightMain,
            text: palette.blueLightText,
        };
        this.error = {
            main: palette.redLightMain,
            text: palette.redLightText,
            border: palette.redLightText,
        };
        this.success = {
            main: palette.greenLightMain,
            text: palette.greenLightText,
        };
        this.warning = {
            main: palette.orangeLightMain,
            text: palette.orangeLightText,
        };
        this.background = {
            canvas: palette.gray90,
            primary: palette.white,
            secondary: palette.gray100,
        };
        this.action = {
            hover: "rgba(" + this.blackBase + ", 0.12)",
            selected: "rgba(" + this.blackBase + ", 0.08)",
            hoverOpacity: 0.08,
            focus: "rgba(" + this.blackBase + ", 0.12)",
            disabledBackground: "rgba(" + this.blackBase + ", 0.04)",
            disabledText: this.text.disabled,
            disabledOpacity: 0.38,
        };
        this.gradients = {
            brandHorizontal: 'linear-gradient(90deg, #FF8833 0%, #F53E4C 100%);',
            brandVertical: 'linear-gradient(0.01deg, #F53E4C -31.2%, #FF8833 113.07%);',
        };
        this.contrastThreshold = 3;
        this.hoverFactor = 0.03;
        this.tonalOffset = 0.2;
    }
    return LightColors;
}());
export function createColors(colors) {
    var _a;
    var dark = new DarkColors();
    var light = new LightColors();
    var base = ((_a = colors.mode) !== null && _a !== void 0 ? _a : 'dark') === 'dark' ? dark : light;
    var _b = colors.primary, primary = _b === void 0 ? base.primary : _b, _c = colors.secondary, secondary = _c === void 0 ? base.secondary : _c, _d = colors.info, info = _d === void 0 ? base.info : _d, _e = colors.warning, warning = _e === void 0 ? base.warning : _e, _f = colors.success, success = _f === void 0 ? base.success : _f, _g = colors.error, error = _g === void 0 ? base.error : _g, _h = colors.tonalOffset, tonalOffset = _h === void 0 ? base.tonalOffset : _h, _j = colors.hoverFactor, hoverFactor = _j === void 0 ? base.hoverFactor : _j, _k = colors.contrastThreshold, contrastThreshold = _k === void 0 ? base.contrastThreshold : _k, other = __rest(colors, ["primary", "secondary", "info", "warning", "success", "error", "tonalOffset", "hoverFactor", "contrastThreshold"]);
    function getContrastText(background, threshold) {
        if (threshold === void 0) { threshold = contrastThreshold; }
        var contrastText = getContrastRatio(dark.text.maxContrast, background, base.background.primary) >= threshold
            ? dark.text.maxContrast
            : light.text.maxContrast;
        // todo, need color framework
        return contrastText;
    }
    var getRichColor = function (_a) {
        var color = _a.color, name = _a.name;
        color = __assign(__assign({}, color), { name: name });
        if (!color.main) {
            throw new Error("Missing main color for " + name);
        }
        if (!color.text) {
            color.text = color.main;
        }
        if (!color.border) {
            color.border = color.text;
        }
        if (!color.shade) {
            color.shade = base.mode === 'light' ? darken(color.main, tonalOffset) : lighten(color.main, tonalOffset);
        }
        if (!color.transparent) {
            color.transparent = base.mode === 'light' ? alpha(color.main, 0.08) : alpha(color.main, 0.15);
        }
        if (!color.contrastText) {
            color.contrastText = getContrastText(color.main);
        }
        return color;
    };
    return merge(__assign(__assign({}, base), { primary: getRichColor({ color: primary, name: 'primary' }), secondary: getRichColor({ color: secondary, name: 'secondary' }), info: getRichColor({ color: info, name: 'info' }), error: getRichColor({ color: error, name: 'error' }), success: getRichColor({ color: success, name: 'success' }), warning: getRichColor({ color: warning, name: 'warning' }), getContrastText: getContrastText, emphasize: function (color, factor) {
            return emphasize(color, factor !== null && factor !== void 0 ? factor : hoverFactor);
        } }), other);
}
//# sourceMappingURL=createColors.js.map