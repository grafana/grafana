import { dateTime } from '../datetime/moment_wrapper';
export var DefaultTimeZone = 'browser';
export var TIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';
export function getDefaultTimeRange() {
    var now = dateTime();
    return {
        from: dateTime(now).subtract(6, 'hour'),
        to: now,
        raw: { from: 'now-6h', to: 'now' },
    };
}
/**
 * Returns the default realtive time range.
 *
 * @public
 */
export function getDefaultRelativeTimeRange() {
    return {
        from: 600,
        to: 0,
    };
}
//# sourceMappingURL=time.js.map