import { __values } from "tslib";
import { getCategories } from './categories';
import { toDateTimeValueFormatter } from './dateTimeFormatters';
import { getOffsetFromSIPrefix, SIPrefix, currency } from './symbolFormatters';
export function formattedValueToString(val) {
    var _a, _b;
    return "" + ((_a = val.prefix) !== null && _a !== void 0 ? _a : '') + val.text + ((_b = val.suffix) !== null && _b !== void 0 ? _b : '');
}
// Globals & formats cache
var categories = [];
var index = {};
var hasBuiltIndex = false;
export function toFixed(value, decimals) {
    if (value === null) {
        return '';
    }
    if (value === Number.NEGATIVE_INFINITY || value === Number.POSITIVE_INFINITY) {
        return value.toLocaleString();
    }
    if (decimals === null || decimals === undefined) {
        decimals = getDecimalsForValue(value);
    }
    var factor = decimals ? Math.pow(10, Math.max(0, decimals)) : 1;
    var formatted = String(Math.round(value * factor) / factor);
    // if exponent return directly
    if (formatted.indexOf('e') !== -1 || value === 0) {
        return formatted;
    }
    var decimalPos = formatted.indexOf('.');
    var precision = decimalPos === -1 ? 0 : formatted.length - decimalPos - 1;
    if (precision < decimals) {
        return (precision ? formatted : formatted + '.') + String(factor).substr(1, decimals - precision);
    }
    return formatted;
}
function getDecimalsForValue(value) {
    var log10 = Math.floor(Math.log(Math.abs(value)) / Math.LN10);
    var dec = -log10 + 1;
    var magn = Math.pow(10, -dec);
    var norm = value / magn; // norm is between 1.0 and 10.0
    // special case for 2.5, requires an extra decimal
    if (norm > 2.25) {
        ++dec;
    }
    if (value % 1 === 0) {
        dec = 0;
    }
    var decimals = Math.max(0, dec);
    return decimals;
}
export function toFixedScaled(value, decimals, ext) {
    return {
        text: toFixed(value, decimals),
        suffix: ext,
    };
}
export function toFixedUnit(unit, asPrefix) {
    return function (size, decimals) {
        if (size === null) {
            return { text: '' };
        }
        var text = toFixed(size, decimals);
        if (unit) {
            if (asPrefix) {
                return { text: text, prefix: unit };
            }
            return { text: text, suffix: ' ' + unit };
        }
        return { text: text };
    };
}
export function isBooleanUnit(unit) {
    return unit && unit.startsWith('bool');
}
export function booleanValueFormatter(t, f) {
    return function (value) {
        return { text: value ? t : f };
    };
}
// Formatter which scales the unit string geometrically according to the given
// numeric factor. Repeatedly scales the value down by the factor until it is
// less than the factor in magnitude, or the end of the array is reached.
export function scaledUnits(factor, extArray) {
    return function (size, decimals, scaledDecimals) {
        if (size === null) {
            return { text: '' };
        }
        if (size === Number.NEGATIVE_INFINITY || size === Number.POSITIVE_INFINITY || isNaN(size)) {
            return { text: size.toLocaleString() };
        }
        var steps = 0;
        var limit = extArray.length;
        while (Math.abs(size) >= factor) {
            steps++;
            size /= factor;
            if (steps >= limit) {
                return { text: 'NA' };
            }
        }
        return { text: toFixed(size, decimals), suffix: extArray[steps] };
    };
}
export function locale(value, decimals) {
    if (value == null) {
        return { text: '' };
    }
    return {
        text: value.toLocaleString(undefined, { maximumFractionDigits: decimals }),
    };
}
export function simpleCountUnit(symbol) {
    var units = ['', 'K', 'M', 'B', 'T'];
    var scaler = scaledUnits(1000, units);
    return function (size, decimals, scaledDecimals) {
        if (size === null) {
            return { text: '' };
        }
        var v = scaler(size, decimals, scaledDecimals);
        v.suffix += ' ' + symbol;
        return v;
    };
}
export function stringFormater(value) {
    return { text: "" + value };
}
function buildFormats() {
    var e_1, _a, e_2, _b;
    categories = getCategories();
    try {
        for (var categories_1 = __values(categories), categories_1_1 = categories_1.next(); !categories_1_1.done; categories_1_1 = categories_1.next()) {
            var cat = categories_1_1.value;
            try {
                for (var _c = (e_2 = void 0, __values(cat.formats)), _d = _c.next(); !_d.done; _d = _c.next()) {
                    var format = _d.value;
                    index[format.id] = format.fn;
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (_d && !_d.done && (_b = _c.return)) _b.call(_c);
                }
                finally { if (e_2) throw e_2.error; }
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (categories_1_1 && !categories_1_1.done && (_a = categories_1.return)) _a.call(categories_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    // Resolve units pointing to old IDs
    [{ from: 'farenheit', to: 'fahrenheit' }].forEach(function (alias) {
        var f = index[alias.to];
        if (f) {
            index[alias.from] = f;
        }
    });
    hasBuiltIndex = true;
}
export function getValueFormat(id) {
    if (!id) {
        return toFixedUnit('');
    }
    if (!hasBuiltIndex) {
        buildFormats();
    }
    var fmt = index[id];
    if (!fmt && id) {
        var idx = id.indexOf(':');
        if (idx > 0) {
            var key = id.substring(0, idx);
            var sub = id.substring(idx + 1);
            if (key === 'prefix') {
                return toFixedUnit(sub, true);
            }
            if (key === 'suffix') {
                return toFixedUnit(sub, false);
            }
            if (key === 'time') {
                return toDateTimeValueFormatter(sub);
            }
            if (key === 'si') {
                var offset = getOffsetFromSIPrefix(sub.charAt(0));
                var unit = offset === 0 ? sub : sub.substring(1);
                return SIPrefix(unit, offset);
            }
            if (key === 'count') {
                return simpleCountUnit(sub);
            }
            if (key === 'currency') {
                return currency(sub);
            }
            if (key === 'bool') {
                idx = sub.indexOf('/');
                if (idx >= 0) {
                    var t = sub.substring(0, idx);
                    var f = sub.substring(idx + 1);
                    return booleanValueFormatter(t, f);
                }
                return booleanValueFormatter(sub, '-');
            }
        }
        return toFixedUnit(id);
    }
    return fmt;
}
export function getValueFormatterIndex() {
    if (!hasBuiltIndex) {
        buildFormats();
    }
    return index;
}
export function getValueFormats() {
    if (!hasBuiltIndex) {
        buildFormats();
    }
    return categories.map(function (cat) {
        return {
            text: cat.name,
            submenu: cat.formats.map(function (format) {
                return {
                    text: format.name,
                    value: format.id,
                };
            }),
        };
    });
}
//# sourceMappingURL=valueFormats.js.map