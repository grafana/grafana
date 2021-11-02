// Code based on Material UI
// The MIT License (MIT)
// Copyright (c) 2014 Call-Em-All
import { __assign } from "tslib";
var defaultFontFamily = '"Roboto", "Helvetica", "Arial", sans-serif';
var defaultFontFamilyMonospace = "'Roboto Mono', monospace";
export function createTypography(colors, typographyInput) {
    if (typographyInput === void 0) { typographyInput = {}; }
    var _a = typographyInput.fontFamily, fontFamily = _a === void 0 ? defaultFontFamily : _a, _b = typographyInput.fontFamilyMonospace, fontFamilyMonospace = _b === void 0 ? defaultFontFamilyMonospace : _b, 
    // The default font size of the Material Specification.
    _c = typographyInput.fontSize, 
    // The default font size of the Material Specification.
    fontSize = _c === void 0 ? 14 : _c, // px
    _d = typographyInput.fontWeightLight, // px
    fontWeightLight = _d === void 0 ? 300 : _d, _e = typographyInput.fontWeightRegular, fontWeightRegular = _e === void 0 ? 400 : _e, _f = typographyInput.fontWeightMedium, fontWeightMedium = _f === void 0 ? 500 : _f, _g = typographyInput.fontWeightBold, fontWeightBold = _g === void 0 ? 500 : _g, 
    // Tell Grafana-UI what's the font-size on the html element.
    // 16px is the default font-size used by browsers.
    _h = typographyInput.htmlFontSize, 
    // Tell Grafana-UI what's the font-size on the html element.
    // 16px is the default font-size used by browsers.
    htmlFontSize = _h === void 0 ? 14 : _h;
    if (process.env.NODE_ENV !== 'production') {
        if (typeof fontSize !== 'number') {
            console.error('Grafana-UI: `fontSize` is required to be a number.');
        }
        if (typeof htmlFontSize !== 'number') {
            console.error('Grafana-UI: `htmlFontSize` is required to be a number.');
        }
    }
    var coef = fontSize / 14;
    var pxToRem = function (size) { return (size / htmlFontSize) * coef + "rem"; };
    var buildVariant = function (fontWeight, size, lineHeight, letterSpacing, casing) { return (__assign(__assign({ fontFamily: fontFamily, fontWeight: fontWeight, fontSize: pxToRem(size), lineHeight: lineHeight }, (fontFamily === defaultFontFamily ? { letterSpacing: round(letterSpacing / size) + "em" } : {})), casing)); };
    var variants = {
        h1: buildVariant(fontWeightLight, 28, 1.167, -0.25),
        h2: buildVariant(fontWeightLight, 24, 1.2, 0),
        h3: buildVariant(fontWeightRegular, 21, 1.167, 0),
        h4: buildVariant(fontWeightRegular, 18, 1.235, 0.25),
        h5: buildVariant(fontWeightRegular, 16, 1.334, 0),
        h6: buildVariant(fontWeightMedium, 14, 1.6, 0.15),
        body: buildVariant(fontWeightRegular, 14, 1.5, 0.15),
        bodySmall: buildVariant(fontWeightRegular, 12, 1.5, 0.15),
    };
    var size = {
        base: '14px',
        xs: '10px',
        sm: '12px',
        md: '14px',
        lg: '18px',
    };
    return __assign({ htmlFontSize: htmlFontSize, pxToRem: pxToRem, fontFamily: fontFamily, fontFamilyMonospace: fontFamilyMonospace, fontSize: fontSize, fontWeightLight: fontWeightLight, fontWeightRegular: fontWeightRegular, fontWeightMedium: fontWeightMedium, fontWeightBold: fontWeightBold, size: size }, variants);
}
function round(value) {
    return Math.round(value * 1e5) / 1e5;
}
//# sourceMappingURL=createTypography.js.map