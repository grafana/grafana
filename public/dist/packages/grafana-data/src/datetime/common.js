import { DefaultTimeZone } from '../types/time';
var defaultTimeZoneResolver = function () { return DefaultTimeZone; };
/**
 * Used by Grafana internals to set the {@link TimeZoneResolver} to access the current
 * user timeZone.
 *
 * @internal
 */
export var setTimeZoneResolver = function (resolver) {
    defaultTimeZoneResolver = resolver !== null && resolver !== void 0 ? resolver : defaultTimeZoneResolver;
};
/**
 * Used to get the current selected time zone. If a valid time zone is passed in the
 * options it will be returned. If no valid time zone is passed either the time zone
 * configured for the user account will be returned or the default for Grafana.
 *
 * @public
 */
export var getTimeZone = function (options) {
    var _a, _b;
    return (_b = (_a = options === null || options === void 0 ? void 0 : options.timeZone) !== null && _a !== void 0 ? _a : defaultTimeZoneResolver()) !== null && _b !== void 0 ? _b : DefaultTimeZone;
};
//# sourceMappingURL=common.js.map