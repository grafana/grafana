import _ from 'lodash';
import kbn from 'app/core/utils/kbn';

export default class TimeGrainConverter {
  static createISO8601Duration(timeGrain, timeGrainUnit) {
    const timeIntervals = ['hour', 'minute', 'h', 'm'];
    if (_.includes(timeIntervals, timeGrainUnit)) {
      return `PT${timeGrain}${timeGrainUnit[0].toUpperCase()}`;
    }

    return `P${timeGrain}${timeGrainUnit[0].toUpperCase()}`;
  }

  static createISO8601DurationFromInterval(interval: string) {
    const timeGrain = +interval.slice(0, interval.length - 1);
    const unit = interval[interval.length - 1];

    if (interval.indexOf('ms') > -1) {
      return TimeGrainConverter.createISO8601Duration(1, 'm');
    }

    if (interval[interval.length - 1] === 's') {
      let toMinutes = (timeGrain * 60) % 60;

      if (toMinutes < 1) {
        toMinutes = 1;
      }

      return TimeGrainConverter.createISO8601Duration(toMinutes, 'm');
    }

    return TimeGrainConverter.createISO8601Duration(timeGrain, unit);
  }

  static findClosestTimeGrain(interval, allowedTimeGrains) {
    const timeGrains = _.filter(allowedTimeGrains, o => o !== 'auto');

    let closest = timeGrains[0];
    const intervalMs = kbn.interval_to_ms(interval);

    for (let i = 0; i < timeGrains.length; i++) {
      // abs (num - val) < abs (num - curr):
      if (intervalMs > kbn.interval_to_ms(timeGrains[i])) {
        if (i + 1 < timeGrains.length) {
          closest = timeGrains[i + 1];
        } else {
          closest = timeGrains[i];
        }
      }
    }

    return closest;
  }

  static createTimeGrainFromISO8601Duration(duration: string) {
    let offset = 1;
    if (duration.substring(0, 2) === 'PT') {
      offset = 2;
    }

    const value = duration.substring(offset, duration.length - 1);
    const unit = duration.substring(duration.length - 1);

    return value + ' ' + TimeGrainConverter.timeUnitToText(+value, unit);
  }

  static timeUnitToText(value: number, unit: string) {
    let text = '';

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
  }

  static createKbnUnitFromISO8601Duration(duration: string) {
    if (duration === 'auto') {
      return 'auto';
    }

    let offset = 1;
    if (duration.substring(0, 2) === 'PT') {
      offset = 2;
    }

    const value = duration.substring(offset, duration.length - 1);
    const unit = duration.substring(duration.length - 1);

    return value + TimeGrainConverter.timeUnitToKbn(+value, unit);
  }

  static timeUnitToKbn(value: number, unit: string) {
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
  }
}
