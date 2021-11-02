import { scaledUnits } from './valueFormats';
export function currency(symbol, asSuffix) {
    var units = ['', 'K', 'M', 'B', 'T'];
    var scaler = scaledUnits(1000, units);
    return function (size, decimals, scaledDecimals) {
        if (size === null) {
            return { text: '' };
        }
        var scaled = scaler(size, decimals, scaledDecimals);
        if (asSuffix) {
            scaled.suffix = scaled.suffix !== undefined ? "" + scaled.suffix + symbol : undefined;
        }
        else {
            scaled.prefix = symbol;
        }
        return scaled;
    };
}
export function getOffsetFromSIPrefix(c) {
    switch (c) {
        case 'f':
            return -5;
        case 'p':
            return -4;
        case 'n':
            return -3;
        case 'μ': // Two different unicode chars for µ
        case 'µ':
            return -2;
        case 'm':
            return -1;
        case '':
            return 0;
        case 'k':
            return 1;
        case 'M':
            return 2;
        case 'G':
            return 3;
        case 'T':
            return 4;
        case 'P':
            return 5;
        case 'E':
            return 6;
        case 'Z':
            return 7;
        case 'Y':
            return 8;
    }
    return 0;
}
export function binaryPrefix(unit, offset) {
    if (offset === void 0) { offset = 0; }
    var prefixes = ['', 'Ki', 'Mi', 'Gi', 'Ti', 'Pi', 'Ei', 'Zi', 'Yi'].slice(offset);
    var units = prefixes.map(function (p) {
        return ' ' + p + unit;
    });
    return scaledUnits(1024, units);
}
export function SIPrefix(unit, offset) {
    if (offset === void 0) { offset = 0; }
    var prefixes = ['f', 'p', 'n', 'µ', 'm', '', 'k', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y'];
    prefixes = prefixes.slice(5 + (offset || 0));
    var units = prefixes.map(function (p) {
        return ' ' + p + unit;
    });
    return scaledUnits(1000, units);
}
//# sourceMappingURL=symbolFormatters.js.map