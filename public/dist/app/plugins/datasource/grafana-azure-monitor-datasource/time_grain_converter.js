import _ from 'lodash';
import kbn from 'app/core/utils/kbn';
var TimeGrainConverter = /** @class */ (function () {
    function TimeGrainConverter() {
    }
    TimeGrainConverter.createISO8601Duration = function (timeGrain, timeGrainUnit) {
        var timeIntervals = ['hour', 'minute', 'h', 'm'];
        if (_.includes(timeIntervals, timeGrainUnit)) {
            return "PT" + timeGrain + timeGrainUnit[0].toUpperCase();
        }
        return "P" + timeGrain + timeGrainUnit[0].toUpperCase();
    };
    TimeGrainConverter.createISO8601DurationFromInterval = function (interval) {
        var timeGrain = +interval.slice(0, interval.length - 1);
        var unit = interval[interval.length - 1];
        if (interval.indexOf('ms') > -1) {
            return TimeGrainConverter.createISO8601Duration(1, 'm');
        }
        if (interval[interval.length - 1] === 's') {
            var toMinutes = (timeGrain * 60) % 60;
            if (toMinutes < 1) {
                toMinutes = 1;
            }
            return TimeGrainConverter.createISO8601Duration(toMinutes, 'm');
        }
        return TimeGrainConverter.createISO8601Duration(timeGrain, unit);
    };
    TimeGrainConverter.findClosestTimeGrain = function (interval, allowedTimeGrains) {
        var timeGrains = _.filter(allowedTimeGrains, function (o) { return o !== 'auto'; });
        var closest = timeGrains[0];
        var intervalMs = kbn.interval_to_ms(interval);
        for (var i = 0; i < timeGrains.length; i++) {
            // abs (num - val) < abs (num - curr):
            if (intervalMs > kbn.interval_to_ms(timeGrains[i])) {
                if (i + 1 < timeGrains.length) {
                    closest = timeGrains[i + 1];
                }
                else {
                    closest = timeGrains[i];
                }
            }
        }
        return closest;
    };
    TimeGrainConverter.createTimeGrainFromISO8601Duration = function (duration) {
        var offset = 1;
        if (duration.substring(0, 2) === 'PT') {
            offset = 2;
        }
        var value = duration.substring(offset, duration.length - 1);
        var unit = duration.substring(duration.length - 1);
        return value + ' ' + TimeGrainConverter.timeUnitToText(+value, unit);
    };
    TimeGrainConverter.timeUnitToText = function (value, unit) {
        var text = '';
        if (unit === 'S') {
            text = 'second';
        }
        if (unit === 'M') {
            text = 'minute';
        }
        if (unit === 'H') {
            text = 'hour';
        }
        if (unit === 'D') {
            text = 'day';
        }
        if (value > 1) {
            return text + 's';
        }
        return text;
    };
    TimeGrainConverter.createKbnUnitFromISO8601Duration = function (duration) {
        if (duration === 'auto') {
            return 'auto';
        }
        var offset = 1;
        if (duration.substring(0, 2) === 'PT') {
            offset = 2;
        }
        var value = duration.substring(offset, duration.length - 1);
        var unit = duration.substring(duration.length - 1);
        return value + TimeGrainConverter.timeUnitToKbn(+value, unit);
    };
    TimeGrainConverter.timeUnitToKbn = function (value, unit) {
        if (unit === 'S') {
            return 's';
        }
        if (unit === 'M') {
            return 'm';
        }
        if (unit === 'H') {
            return 'h';
        }
        if (unit === 'D') {
            return 'd';
        }
        return '';
    };
    return TimeGrainConverter;
}());
export default TimeGrainConverter;
//# sourceMappingURL=time_grain_converter.js.map