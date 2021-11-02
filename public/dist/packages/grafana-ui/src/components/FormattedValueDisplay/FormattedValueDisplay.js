import { __assign, __rest } from "tslib";
import React from 'react';
function fontSizeReductionFactor(fontSize) {
    if (fontSize < 20) {
        return 0.9;
    }
    if (fontSize < 26) {
        return 0.8;
    }
    return 0.6;
}
export var FormattedValueDisplay = function (_a) {
    var _b, _c;
    var value = _a.value, className = _a.className, style = _a.style, htmlProps = __rest(_a, ["value", "className", "style"]);
    var hasPrefix = ((_b = value.prefix) !== null && _b !== void 0 ? _b : '').length > 0;
    var hasSuffix = ((_c = value.suffix) !== null && _c !== void 0 ? _c : '').length > 0;
    var suffixStyle;
    if (style && style.fontSize) {
        var fontSize = style === null || style === void 0 ? void 0 : style.fontSize;
        var reductionFactor = fontSizeReductionFactor(fontSize);
        suffixStyle = { fontSize: fontSize * reductionFactor };
    }
    return (React.createElement("div", __assign({ className: className, style: style }, htmlProps),
        React.createElement("div", null,
            hasPrefix && React.createElement("span", null, value.prefix),
            React.createElement("span", null, value.text),
            hasSuffix && React.createElement("span", { style: suffixStyle }, value.suffix))));
};
FormattedValueDisplay.displayName = 'FormattedDisplayValue';
//# sourceMappingURL=FormattedValueDisplay.js.map