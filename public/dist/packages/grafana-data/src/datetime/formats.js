import { __read, __spreadArray } from "tslib";
var DEFAULT_SYSTEM_DATE_FORMAT = 'YYYY-MM-DD HH:mm:ss';
var SystemDateFormatsState = /** @class */ (function () {
    function SystemDateFormatsState() {
        this.fullDate = DEFAULT_SYSTEM_DATE_FORMAT;
        this.interval = {
            second: 'HH:mm:ss',
            minute: 'HH:mm',
            hour: 'MM/DD HH:mm',
            day: 'MM/DD',
            month: 'YYYY-MM',
            year: 'YYYY',
        };
    }
    SystemDateFormatsState.prototype.update = function (settings) {
        this.fullDate = settings.fullDate;
        this.interval = settings.interval;
        if (settings.useBrowserLocale) {
            this.useBrowserLocale();
        }
    };
    Object.defineProperty(SystemDateFormatsState.prototype, "fullDateMS", {
        get: function () {
            // Add millisecond to seconds part
            return this.fullDate.replace('ss', 'ss.SSS');
        },
        enumerable: false,
        configurable: true
    });
    SystemDateFormatsState.prototype.useBrowserLocale = function () {
        this.fullDate = localTimeFormat({
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
        this.interval.second = localTimeFormat({ hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }, null, this.interval.second);
        this.interval.minute = localTimeFormat({ hour: '2-digit', minute: '2-digit', hour12: false }, null, this.interval.minute);
        this.interval.hour = localTimeFormat({ month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }, null, this.interval.hour);
        this.interval.day = localTimeFormat({ month: '2-digit', day: '2-digit', hour12: false }, null, this.interval.day);
        this.interval.month = localTimeFormat({ year: 'numeric', month: '2-digit', hour12: false }, null, this.interval.month);
    };
    SystemDateFormatsState.prototype.getTimeFieldUnit = function (useMsResolution) {
        return "time:" + (useMsResolution ? this.fullDateMS : this.fullDate);
    };
    return SystemDateFormatsState;
}());
export { SystemDateFormatsState };
/**
 * localTimeFormat helps to generate date formats for momentjs based on browser's locale
 *
 * @param locale browser locale, or default
 * @param options DateTimeFormatOptions to format date
 * @param fallback default format if Intl API is not present
 */
export function localTimeFormat(options, locale, fallback) {
    if (missingIntlDateTimeFormatSupport()) {
        return fallback !== null && fallback !== void 0 ? fallback : DEFAULT_SYSTEM_DATE_FORMAT;
    }
    if (!locale && navigator) {
        locale = __spreadArray([], __read(navigator.languages), false);
    }
    // https://momentjs.com/docs/#/displaying/format/
    var dateTimeFormat = new Intl.DateTimeFormat(locale || undefined, options);
    var parts = dateTimeFormat.formatToParts(new Date());
    var hour12 = dateTimeFormat.resolvedOptions().hour12;
    var mapping = {
        year: 'YYYY',
        month: 'MM',
        day: 'DD',
        hour: hour12 ? 'hh' : 'HH',
        minute: 'mm',
        second: 'ss',
        weekday: 'ddd',
        era: 'N',
        dayPeriod: 'A',
        timeZoneName: 'Z',
    };
    return parts.map(function (part) { return mapping[part.type] || part.value; }).join('');
}
export var systemDateFormats = new SystemDateFormatsState();
var missingIntlDateTimeFormatSupport = function () {
    return !('DateTimeFormat' in Intl) || !('formatToParts' in Intl.DateTimeFormat.prototype);
};
//# sourceMappingURL=formats.js.map