import { toFixed } from './valueFormats';
export function toPercent(size, decimals) {
    if (size === null) {
        return { text: '' };
    }
    return { text: toFixed(size, decimals), suffix: '%' };
}
export function toPercentUnit(size, decimals) {
    if (size === null) {
        return { text: '' };
    }
    return { text: toFixed(100 * size, decimals), suffix: '%' };
}
export function toHex0x(value, decimals) {
    if (value == null) {
        return { text: '' };
    }
    var asHex = toHex(value, decimals);
    if (asHex.text.substring(0, 1) === '-') {
        asHex.text = '-0x' + asHex.text.substring(1);
    }
    else {
        asHex.text = '0x' + asHex.text;
    }
    return asHex;
}
export function toHex(value, decimals) {
    if (value == null) {
        return { text: '' };
    }
    return {
        text: parseFloat(toFixed(value, decimals)).toString(16).toUpperCase(),
    };
}
export function sci(value, decimals) {
    if (value == null) {
        return { text: '' };
    }
    return { text: value.toExponential(decimals) };
}
//# sourceMappingURL=arithmeticFormatters.js.map