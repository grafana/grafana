import { deprecationWarning, formattedValueToString, getValueFormat, getValueFormats, getValueFormatterIndex, stringToJsRegex, rangeUtil, escapeRegex, } from '@grafana/data';
const valueFormats = {};
const kbn = {
    valueFormats,
    intervalRegex: /(\d+(?:\.\d+)?)(ms|[Mwdhmsy])/,
    intervalsInSeconds: {
        y: 31536000,
        M: 2592000,
        w: 604800,
        d: 86400,
        h: 3600,
        m: 60,
        s: 1,
        ms: 0.001,
    },
    /** @deprecated since 9.4, use grafana/data */
    regexEscape: (value) => {
        deprecationWarning('kbn.ts', 'kbn.regexEscape()', 'escapeRegex from @grafana/data');
        return escapeRegex(value);
    },
    /** @deprecated since 7.2, use grafana/data */
    roundInterval: (interval) => {
        deprecationWarning('kbn.ts', 'kbn.roundInterval()', '@grafana/data');
        return rangeUtil.roundInterval(interval);
    },
    /** @deprecated since 7.2, use grafana/data */
    secondsToHms: (s) => {
        deprecationWarning('kbn.ts', 'kbn.secondsToHms()', '@grafana/data');
        return rangeUtil.secondsToHms(s);
    },
    secondsToHhmmss: (seconds) => {
        const strings = [];
        const numHours = Math.floor(seconds / 3600);
        const numMinutes = Math.floor((seconds % 3600) / 60);
        const numSeconds = Math.floor((seconds % 3600) % 60);
        numHours > 9 ? strings.push('' + numHours) : strings.push('0' + numHours);
        numMinutes > 9 ? strings.push('' + numMinutes) : strings.push('0' + numMinutes);
        numSeconds > 9 ? strings.push('' + numSeconds) : strings.push('0' + numSeconds);
        return strings.join(':');
    },
    toPercent: (nr, outOf) => Math.floor((nr / outOf) * 10000) / 100 + '%',
    addSlashes: (str) => str.replace(/[\'\"\\0]/g, '\\$&'),
    /** @deprecated since 7.2, use grafana/data */
    describeInterval: (str) => {
        deprecationWarning('kbn.ts', 'kbn.describeInterval()', '@grafana/data');
        return rangeUtil.describeInterval(str);
    },
    /** @deprecated since 7.2, use grafana/data */
    intervalToSeconds: (str) => {
        deprecationWarning('kbn.ts', 'rangeUtil.intervalToSeconds()', '@grafana/data');
        return rangeUtil.intervalToSeconds(str);
    },
    /** @deprecated since 7.2, use grafana/data */
    intervalToMs: (str) => {
        deprecationWarning('kbn.ts', 'rangeUtil.intervalToMs()', '@grafana/data');
        return rangeUtil.intervalToMs(str);
    },
    /** @deprecated since 7.2, use grafana/data */
    calculateInterval: (range, resolution, lowLimitInterval) => {
        deprecationWarning('kbn.ts', 'kbn.calculateInterval()', '@grafana/data');
        return rangeUtil.calculateInterval(range, resolution, lowLimitInterval);
    },
    queryColorDot: (color, diameter) => {
        return ('<div class="icon-circle" style="' +
            ['display:inline-block', 'color:' + color, 'font-size:' + diameter + 'px'].join(';') +
            '"></div>');
    },
    slugifyForUrl: (str) => {
        return str
            .toLowerCase()
            .replace(/[^\w ]+/g, '')
            .replace(/ +/g, '-');
    },
    /** @deprecated since 6.1, use grafana/data */
    stringToJsRegex: (str) => {
        deprecationWarning('kbn.ts', 'kbn.stringToJsRegex()', '@grafana/data');
        return stringToJsRegex(str);
    },
    toFixed: (value, decimals) => {
        if (value === null) {
            return '';
        }
        const factor = decimals ? Math.pow(10, Math.max(0, decimals)) : 1;
        const formatted = String(Math.round(value * factor) / factor);
        // if exponent return directly
        if (formatted.indexOf('e') !== -1 || value === 0) {
            return formatted;
        }
        // If tickDecimals was specified, ensure that we have exactly that
        // much precision; otherwise default to the value's own precision.
        if (decimals != null) {
            const decimalPos = formatted.indexOf('.');
            const precision = decimalPos === -1 ? 0 : formatted.length - decimalPos - 1;
            if (precision < decimals) {
                return (precision ? formatted : formatted + '.') + String(factor).slice(1, decimals - precision + 1);
            }
        }
        return formatted;
    },
    toFixedScaled: (value, decimals, scaledDecimals, additionalDecimals, ext) => {
        if (scaledDecimals === null) {
            return kbn.toFixed(value, decimals) + ext;
        }
        else {
            return kbn.toFixed(value, scaledDecimals + additionalDecimals) + ext;
        }
    },
    roundValue: (num, decimals) => {
        if (num === null) {
            return null;
        }
        const n = Math.pow(10, decimals);
        const formatted = (n * num).toFixed(decimals);
        return Math.round(parseFloat(formatted)) / n;
    },
    // FORMAT MENU
    getUnitFormats: getValueFormats,
};
/**
 * Backward compatible layer for value formats to support old plugins
 */
if (typeof Proxy !== 'undefined') {
    kbn.valueFormats = new Proxy(kbn.valueFormats, {
        get(target, name, receiver) {
            if (typeof name !== 'string') {
                throw { message: `Value format ${String(name)} is not a string` };
            }
            const formatter = getValueFormat(name);
            if (formatter) {
                // Return the results as a simple string
                return (value, decimals, scaledDecimals, isUtc) => {
                    return formattedValueToString(formatter(value, decimals, scaledDecimals, isUtc ? 'utc' : 'browser'));
                };
            }
            // default to look here
            return Reflect.get(target, name, receiver);
        },
    });
}
else {
    kbn.valueFormats = getValueFormatterIndex();
}
export default kbn;
//# sourceMappingURL=kbn.js.map