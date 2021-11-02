// Code based on Material-UI
// https://github.com/mui-org/material-ui/blob/1b096070faf102281f8e3c4f9b2bf50acf91f412/packages/material-ui/src/styles/colorManipulator.js#L97
// MIT License Copyright (c) 2014 Call-Em-All
import tinycolor from 'tinycolor2';
/**
 * Returns a number whose value is limited to the given range.
 * @param value The value to be clamped
 * @param min The lower boundary of the output range
 * @param max The upper boundary of the output range
 * @returns A number in the range [min, max]
 * @beta
 */
function clamp(value, min, max) {
    if (min === void 0) { min = 0; }
    if (max === void 0) { max = 1; }
    if (process.env.NODE_ENV !== 'production') {
        if (value < min || value > max) {
            console.error("The value provided " + value + " is out of range [" + min + ", " + max + "].");
        }
    }
    return Math.min(Math.max(min, value), max);
}
/**
 * Converts a color from CSS hex format to CSS rgb format.
 * @param color - Hex color, i.e. #nnn or #nnnnnn
 * @returns A CSS rgb color string
 * @beta
 */
export function hexToRgb(color) {
    color = color.substr(1);
    var re = new RegExp(".{1," + (color.length >= 6 ? 2 : 1) + "}", 'g');
    var colors = color.match(re);
    if (colors && colors[0].length === 1) {
        colors = colors.map(function (n) { return n + n; });
    }
    return colors
        ? "rgb" + (colors.length === 4 ? 'a' : '') + "(" + colors
            .map(function (n, index) {
            return index < 3 ? parseInt(n, 16) : Math.round((parseInt(n, 16) / 255) * 1000) / 1000;
        })
            .join(', ') + ")"
        : '';
}
function intToHex(int) {
    var hex = int.toString(16);
    return hex.length === 1 ? "0" + hex : hex;
}
/**
 * Converts a color from CSS rgb format to CSS hex format.
 * @param color - RGB color, i.e. rgb(n, n, n)
 * @returns A CSS rgb color string, i.e. #nnnnnn
 * @beta
 */
export function rgbToHex(color) {
    // Idempotent
    if (color.indexOf('#') === 0) {
        return color;
    }
    var values = decomposeColor(color).values;
    return "#" + values.map(function (n) { return intToHex(n); }).join('');
}
/**
 * Converts a color to hex6 format if there is no alpha, hex8 if there is.
 * @param color - Hex, RGB, HSL color
 * @returns A hex color string, i.e. #ff0000 or #ff0000ff
 */
export function asHexString(color) {
    if (color[0] === '#') {
        return color;
    }
    var tColor = tinycolor(color);
    return tColor.getAlpha() === 1 ? tColor.toHexString() : tColor.toHex8String();
}
/**
 * Converts a color from hsl format to rgb format.
 * @param color - HSL color values
 * @returns rgb color values
 * @beta
 */
export function hslToRgb(color) {
    var parts = decomposeColor(color);
    var values = parts.values;
    var h = values[0];
    var s = values[1] / 100;
    var l = values[2] / 100;
    var a = s * Math.min(l, 1 - l);
    var f = function (n, k) {
        if (k === void 0) { k = (n + h / 30) % 12; }
        return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    };
    var type = 'rgb';
    var rgb = [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
    if (parts.type === 'hsla') {
        type += 'a';
        rgb.push(values[3]);
    }
    return recomposeColor({ type: type, values: rgb });
}
/**
 * Returns an object with the type and values of a color.
 *
 * Note: Does not support rgb % values.
 * @param color - CSS color, i.e. one of: #nnn, #nnnnnn, rgb(), rgba(), hsl(), hsla()
 * @returns {object} - A MUI color object: {type: string, values: number[]}
 * @beta
 */
export function decomposeColor(color) {
    // Idempotent
    if (typeof color !== 'string') {
        return color;
    }
    if (color.charAt(0) === '#') {
        return decomposeColor(hexToRgb(color));
    }
    var marker = color.indexOf('(');
    var type = color.substring(0, marker);
    if (['rgb', 'rgba', 'hsl', 'hsla', 'color'].indexOf(type) === -1) {
        throw new Error("Unsupported '" + color + "' color. The following formats are supported: #nnn, #nnnnnn, rgb(), rgba(), hsl(), hsla(), color()");
    }
    var values = color.substring(marker + 1, color.length - 1);
    var colorSpace;
    if (type === 'color') {
        values = values.split(' ');
        colorSpace = values.shift();
        if (values.length === 4 && values[3].charAt(0) === '/') {
            values[3] = values[3].substr(1);
        }
        if (['srgb', 'display-p3', 'a98-rgb', 'prophoto-rgb', 'rec-2020'].indexOf(colorSpace) === -1) {
            throw new Error("Unsupported " + colorSpace + " color space. The following color spaces are supported: srgb, display-p3, a98-rgb, prophoto-rgb, rec-2020.");
        }
    }
    else {
        values = values.split(',');
    }
    values = values.map(function (value) { return parseFloat(value); });
    return { type: type, values: values, colorSpace: colorSpace };
}
/**
 * Converts a color object with type and values to a string.
 * @param {object} color - Decomposed color
 * @param color.type - One of: 'rgb', 'rgba', 'hsl', 'hsla'
 * @param {array} color.values - [n,n,n] or [n,n,n,n]
 * @returns A CSS color string
 * @beta
 */
export function recomposeColor(color) {
    var type = color.type, colorSpace = color.colorSpace;
    var values = color.values;
    if (type.indexOf('rgb') !== -1) {
        // Only convert the first 3 values to int (i.e. not alpha)
        values = values.map(function (n, i) { return (i < 3 ? parseInt(n, 10) : n); });
    }
    else if (type.indexOf('hsl') !== -1) {
        values[1] = values[1] + "%";
        values[2] = values[2] + "%";
    }
    if (type.indexOf('color') !== -1) {
        values = colorSpace + " " + values.join(' ');
    }
    else {
        values = "" + values.join(', ');
    }
    return type + "(" + values + ")";
}
/**
 * Calculates the contrast ratio between two colors.
 *
 * Formula: https://www.w3.org/TR/WCAG20-TECHS/G17.html#G17-tests
 * @param foreground - CSS color, i.e. one of: #nnn, #nnnnnn, rgb(), rgba(), hsl(), hsla()
 * @param background - CSS color, i.e. one of: #nnn, #nnnnnn, rgb(), rgba(), hsl(), hsla()
 * @param canvas - A CSS color that alpha based backgrounds blends into
 * @returns A contrast ratio value in the range 0 - 21.
 * @beta
 */
export function getContrastRatio(foreground, background, canvas) {
    var lumA = getLuminance(foreground);
    var lumB = getLuminance(background, canvas);
    return (Math.max(lumA, lumB) + 0.05) / (Math.min(lumA, lumB) + 0.05);
}
/**
 * The relative brightness of any point in a color space,
 * normalized to 0 for darkest black and 1 for lightest white.
 *
 * Formula: https://www.w3.org/TR/WCAG20-TECHS/G17.html#G17-tests
 * @param color - CSS color, i.e. one of: #nnn, #nnnnnn, rgb(), rgba(), hsl(), hsla(), color()
 * @param background - CSS color that needs to be take in to account to calculate luminance for colors with opacity
 * @returns The relative brightness of the color in the range 0 - 1
 * @beta
 */
export function getLuminance(color, background) {
    var parts = decomposeColor(color);
    var rgb = parts.type === 'hsl' ? decomposeColor(hslToRgb(color)).values : parts.values;
    if (background && parts.type === 'rgba') {
        var backgroundParts = decomposeColor(background);
        var alpha_1 = rgb[3];
        rgb[0] = rgb[0] * alpha_1 + backgroundParts.values[0] * (1 - alpha_1);
        rgb[1] = rgb[1] * alpha_1 + backgroundParts.values[1] * (1 - alpha_1);
        rgb[2] = rgb[2] * alpha_1 + backgroundParts.values[2] * (1 - alpha_1);
    }
    var rgbNumbers = rgb.map(function (val) {
        if (parts.type !== 'color') {
            val /= 255; // normalized
        }
        return val <= 0.03928 ? val / 12.92 : Math.pow(((val + 0.055) / 1.055), 2.4);
    });
    // Truncate at 3 digits
    return Number((0.2126 * rgbNumbers[0] + 0.7152 * rgbNumbers[1] + 0.0722 * rgbNumbers[2]).toFixed(3));
}
/**
 * Darken or lighten a color, depending on its luminance.
 * Light colors are darkened, dark colors are lightened.
 * @param color - CSS color, i.e. one of: #nnn, #nnnnnn, rgb(), rgba(), hsl(), hsla(), color()
 * @param coefficient=0.15 - multiplier in the range 0 - 1
 * @returns A CSS color string. Hex input values are returned as rgb
 * @beta
 */
export function emphasize(color, coefficient) {
    if (coefficient === void 0) { coefficient = 0.15; }
    return getLuminance(color) > 0.5 ? darken(color, coefficient) : lighten(color, coefficient);
}
/**
 * Set the absolute transparency of a color.
 * Any existing alpha values are overwritten.
 * @param color - CSS color, i.e. one of: #nnn, #nnnnnn, rgb(), rgba(), hsl(), hsla(), color()
 * @param value - value to set the alpha channel to in the range 0 - 1
 * @returns A CSS color string. Hex input values are returned as rgb
 * @beta
 */
export function alpha(color, value) {
    if (color === '') {
        return '#000000';
    }
    value = clamp(value);
    // hex 3, hex 4 (w/alpha), hex 6, hex 8 (w/alpha)
    if (color[0] === '#') {
        if (color.length === 9) {
            color = color.substring(0, 7);
        }
        else if (color.length <= 5) {
            var c = '#';
            for (var i = 1; i < 4; i++) {
                c += color[i] + color[i];
            }
            color = c;
        }
        return (color +
            Math.round(value * 255)
                .toString(16)
                .padStart(2, '0'));
    }
    // rgb(, hsl(
    else if (color[3] === '(') {
        // rgb() and hsl() do not require the "a" suffix to accept alpha values in modern browsers:
        // https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/rgb()#accepts_alpha_value
        return color.replace(')', ", " + value + ")");
    }
    // rgba(, hsla(
    else if (color[4] === '(') {
        return color.substring(0, color.lastIndexOf(',')) + (", " + value + ")");
    }
    var parts = decomposeColor(color);
    if (parts.type === 'color') {
        parts.values[3] = "/" + value;
    }
    else {
        parts.values[3] = value;
    }
    return recomposeColor(parts);
}
/**
 * Darkens a color.
 * @param color - CSS color, i.e. one of: #nnn, #nnnnnn, rgb(), rgba(), hsl(), hsla(), color()
 * @param coefficient - multiplier in the range 0 - 1
 * @returns A CSS color string. Hex input values are returned as rgb
 * @beta
 */
export function darken(color, coefficient) {
    var parts = decomposeColor(color);
    coefficient = clamp(coefficient);
    if (parts.type.indexOf('hsl') !== -1) {
        parts.values[2] *= 1 - coefficient;
    }
    else if (parts.type.indexOf('rgb') !== -1 || parts.type.indexOf('color') !== -1) {
        for (var i = 0; i < 3; i += 1) {
            parts.values[i] *= 1 - coefficient;
        }
    }
    return recomposeColor(parts);
}
/**
 * Lightens a color.
 * @param color - CSS color, i.e. one of: #nnn, #nnnnnn, rgb(), rgba(), hsl(), hsla(), color()
 * @param coefficient - multiplier in the range 0 - 1
 * @returns A CSS color string. Hex input values are returned as rgb
 * @beta
 */
export function lighten(color, coefficient) {
    var parts = decomposeColor(color);
    coefficient = clamp(coefficient);
    if (parts.type.indexOf('hsl') !== -1) {
        parts.values[2] += (100 - parts.values[2]) * coefficient;
    }
    else if (parts.type.indexOf('rgb') !== -1) {
        for (var i = 0; i < 3; i += 1) {
            parts.values[i] += (255 - parts.values[i]) * coefficient;
        }
    }
    else if (parts.type.indexOf('color') !== -1) {
        for (var i = 0; i < 3; i += 1) {
            parts.values[i] += (1 - parts.values[i]) * coefficient;
        }
    }
    return recomposeColor(parts);
}
//# sourceMappingURL=colorManipulator.js.map