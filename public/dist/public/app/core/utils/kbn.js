import { deprecationWarning, formattedValueToString, getValueFormat, getValueFormats, getValueFormatterIndex, stringToJsRegex, rangeUtil, } from '@grafana/data';
var kbn = {
    valueFormats: {},
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
    regexEscape: function (value) { return value.replace(/[\\^$*+?.()|[\]{}\/]/g, '\\$&'); },
    /** @deprecated since 7.2, use grafana/data */
    roundInterval: function (interval) {
        deprecationWarning('kbn.ts', 'kbn.roundInterval()', '@grafana/data');
        return rangeUtil.roundInterval(interval);
    },
    /** @deprecated since 7.2, use grafana/data */
    secondsToHms: function (s) {
        deprecationWarning('kbn.ts', 'kbn.secondsToHms()', '@grafana/data');
        return rangeUtil.secondsToHms(s);
    },
    secondsToHhmmss: function (seconds) {
        var strings = [];
        var numHours = Math.floor(seconds / 3600);
        var numMinutes = Math.floor((seconds % 3600) / 60);
        var numSeconds = Math.floor((seconds % 3600) % 60);
        numHours > 9 ? strings.push('' + numHours) : strings.push('0' + numHours);
        numMinutes > 9 ? strings.push('' + numMinutes) : strings.push('0' + numMinutes);
        numSeconds > 9 ? strings.push('' + numSeconds) : strings.push('0' + numSeconds);
        return strings.join(':');
    },
    toPercent: function (nr, outOf) { return Math.floor((nr / outOf) * 10000) / 100 + '%'; },
    addSlashes: function (str) {
        str = str.replace(/\\/g, '\\\\');
        str = str.replace(/\'/g, "\\'");
        str = str.replace(/\"/g, '\\"');
        str = str.replace(/\0/g, '\\0');
        return str;
    },
    /** @deprecated since 7.2, use grafana/data */
    describeInterval: function (str) {
        deprecationWarning('kbn.ts', 'kbn.stringToJsRegex()', '@grafana/data');
        return rangeUtil.describeInterval(str);
    },
    /** @deprecated since 7.2, use grafana/data */
    intervalToSeconds: function (str) {
        deprecationWarning('kbn.ts', 'rangeUtil.intervalToSeconds()', '@grafana/data');
        return rangeUtil.intervalToSeconds(str);
    },
    /** @deprecated since 7.2, use grafana/data */
    intervalToMs: function (str) {
        deprecationWarning('kbn.ts', 'rangeUtil.intervalToMs()', '@grafana/data');
        return rangeUtil.intervalToMs(str);
    },
    /** @deprecated since 7.2, use grafana/data */
    calculateInterval: function (range, resolution, lowLimitInterval) {
        deprecationWarning('kbn.ts', 'kbn.calculateInterval()', '@grafana/data');
        return rangeUtil.calculateInterval(range, resolution, lowLimitInterval);
    },
    queryColorDot: function (color, diameter) {
        return ('<div class="icon-circle" style="' +
            ['display:inline-block', 'color:' + color, 'font-size:' + diameter + 'px'].join(';') +
            '"></div>');
    },
    slugifyForUrl: function (str) {
        return str
            .toLowerCase()
            .replace(/[^\w ]+/g, '')
            .replace(/ +/g, '-');
    },
    /** @deprecated since 6.1, use grafana/data */
    stringToJsRegex: function (str) {
        deprecationWarning('kbn.ts', 'kbn.stringToJsRegex()', '@grafana/data');
        return stringToJsRegex(str);
    },
    toFixed: function (value, decimals) {
        if (value === null) {
            return '';
        }
        var factor = decimals ? Math.pow(10, Math.max(0, decimals)) : 1;
        var formatted = String(Math.round(value * factor) / factor);
        // if exponent return directly
        if (formatted.indexOf('e') !== -1 || value === 0) {
            return formatted;
        }
        // If tickDecimals was specified, ensure that we have exactly that
        // much precision; otherwise default to the value's own precision.
        if (decimals != null) {
            var decimalPos = formatted.indexOf('.');
            var precision = decimalPos === -1 ? 0 : formatted.length - decimalPos - 1;
            if (precision < decimals) {
                return (precision ? formatted : formatted + '.') + String(factor).substr(1, decimals - precision);
            }
        }
        return formatted;
    },
    toFixedScaled: function (value, decimals, scaledDecimals, additionalDecimals, ext) {
        if (scaledDecimals === null) {
            return kbn.toFixed(value, decimals) + ext;
        }
        else {
            return kbn.toFixed(value, scaledDecimals + additionalDecimals) + ext;
        }
    },
    roundValue: function (num, decimals) {
        if (num === null) {
            return null;
        }
        var n = Math.pow(10, decimals);
        var formatted = (n * num).toFixed(decimals);
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
        get: function (target, name, receiver) {
            if (typeof name !== 'string') {
                throw { message: "Value format " + String(name) + " is not a string" };
            }
            var formatter = getValueFormat(name);
            if (formatter) {
                // Return the results as a simple string
                return function (value, decimals, scaledDecimals, isUtc) {
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