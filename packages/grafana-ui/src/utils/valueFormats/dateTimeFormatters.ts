import { toFixed, toFixedScaled } from './valueFormats';
import { DecimalCount } from '../../types';
import moment from 'moment';

interface IntervalsInSeconds {
  [interval: string]: number;
}

export enum Interval {
  Year = 'year',
  Month = 'month',
  Week = 'week',
  Day = 'day',
  Hour = 'hour',
  Minute = 'minute',
  Second = 'second',
  Millisecond = 'millisecond',
}

const INTERVALS_IN_SECONDS: IntervalsInSeconds = {
  [Interval.Year]: 31536000,
  [Interval.Month]: 2592000,
  [Interval.Week]: 604800,
  [Interval.Day]: 86400,
  [Interval.Hour]: 3600,
  [Interval.Minute]: 60,
  [Interval.Second]: 1,
  [Interval.Millisecond]: 0.001,
};

export function toNanoSeconds(size: number, decimals?: DecimalCount, scaledDecimals?: DecimalCount) {
  if (size === null) {
    return '';
  }

  if (Math.abs(size) < 1000) {
    return toFixed(size, decimals) + ' ns';
  } else if (Math.abs(size) < 1000000) {
    return toFixedScaled(size / 1000, decimals, scaledDecimals, 3, ' µs');
  } else if (Math.abs(size) < 1000000000) {
    return toFixedScaled(size / 1000000, decimals, scaledDecimals, 6, ' ms');
  } else if (Math.abs(size) < 60000000000) {
    return toFixedScaled(size / 1000000000, decimals, scaledDecimals, 9, ' s');
  } else {
    return toFixedScaled(size / 60000000000, decimals, scaledDecimals, 12, ' min');
  }
}

export function toMicroSeconds(size: number, decimals?: DecimalCount, scaledDecimals?: DecimalCount) {
  if (size === null) {
    return '';
  }

  if (Math.abs(size) < 1000) {
    return toFixed(size, decimals) + ' µs';
  } else if (Math.abs(size) < 1000000) {
    return toFixedScaled(size / 1000, decimals, scaledDecimals, 3, ' ms');
  } else {
    return toFixedScaled(size / 1000000, decimals, scaledDecimals, 6, ' s');
  }
}

export function toMilliSeconds(size: number, decimals?: DecimalCount, scaledDecimals?: DecimalCount) {
  if (size === null) {
    return '';
  }

  if (Math.abs(size) < 1000) {
    return toFixed(size, decimals) + ' ms';
  } else if (Math.abs(size) < 60000) {
    // Less than 1 min
    return toFixedScaled(size / 1000, decimals, scaledDecimals, 3, ' s');
  } else if (Math.abs(size) < 3600000) {
    // Less than 1 hour, divide in minutes
    return toFixedScaled(size / 60000, decimals, scaledDecimals, 5, ' min');
  } else if (Math.abs(size) < 86400000) {
    // Less than one day, divide in hours
    return toFixedScaled(size / 3600000, decimals, scaledDecimals, 7, ' hour');
  } else if (Math.abs(size) < 31536000000) {
    // Less than one year, divide in days
    return toFixedScaled(size / 86400000, decimals, scaledDecimals, 8, ' day');
  }

  return toFixedScaled(size / 31536000000, decimals, scaledDecimals, 10, ' year');
}

export function trySubstract(value1: DecimalCount, value2: DecimalCount): DecimalCount {
  if (value1 !== null && value1 !== undefined && value2 !== null && value2 !== undefined) {
    return value1 - value2;
  }
  return undefined;
}

export function toSeconds(size: number, decimals?: DecimalCount, scaledDecimals?: DecimalCount) {
  if (size === null) {
    return '';
  }

  // Less than 1 µs, divide in ns
  if (Math.abs(size) < 0.000001) {
    return toFixedScaled(size * 1e9, decimals, trySubstract(scaledDecimals, decimals), -9, ' ns');
  }
  // Less than 1 ms, divide in µs
  if (Math.abs(size) < 0.001) {
    return toFixedScaled(size * 1e6, decimals, trySubstract(scaledDecimals, decimals), -6, ' µs');
  }
  // Less than 1 second, divide in ms
  if (Math.abs(size) < 1) {
    return toFixedScaled(size * 1e3, decimals, trySubstract(scaledDecimals, decimals), -3, ' ms');
  }

  if (Math.abs(size) < 60) {
    return toFixed(size, decimals) + ' s';
  } else if (Math.abs(size) < 3600) {
    // Less than 1 hour, divide in minutes
    return toFixedScaled(size / 60, decimals, scaledDecimals, 1, ' min');
  } else if (Math.abs(size) < 86400) {
    // Less than one day, divide in hours
    return toFixedScaled(size / 3600, decimals, scaledDecimals, 4, ' hour');
  } else if (Math.abs(size) < 604800) {
    // Less than one week, divide in days
    return toFixedScaled(size / 86400, decimals, scaledDecimals, 5, ' day');
  } else if (Math.abs(size) < 31536000) {
    // Less than one year, divide in week
    return toFixedScaled(size / 604800, decimals, scaledDecimals, 6, ' week');
  }

  return toFixedScaled(size / 3.15569e7, decimals, scaledDecimals, 7, ' year');
}

export function toMinutes(size: number, decimals?: DecimalCount, scaledDecimals?: DecimalCount) {
  if (size === null) {
    return '';
  }

  if (Math.abs(size) < 60) {
    return toFixed(size, decimals) + ' min';
  } else if (Math.abs(size) < 1440) {
    return toFixedScaled(size / 60, decimals, scaledDecimals, 2, ' hour');
  } else if (Math.abs(size) < 10080) {
    return toFixedScaled(size / 1440, decimals, scaledDecimals, 3, ' day');
  } else if (Math.abs(size) < 604800) {
    return toFixedScaled(size / 10080, decimals, scaledDecimals, 4, ' week');
  } else {
    return toFixedScaled(size / 5.25948e5, decimals, scaledDecimals, 5, ' year');
  }
}

export function toHours(size: number, decimals?: DecimalCount, scaledDecimals?: DecimalCount) {
  if (size === null) {
    return '';
  }

  if (Math.abs(size) < 24) {
    return toFixed(size, decimals) + ' hour';
  } else if (Math.abs(size) < 168) {
    return toFixedScaled(size / 24, decimals, scaledDecimals, 2, ' day');
  } else if (Math.abs(size) < 8760) {
    return toFixedScaled(size / 168, decimals, scaledDecimals, 3, ' week');
  } else {
    return toFixedScaled(size / 8760, decimals, scaledDecimals, 4, ' year');
  }
}

export function toDays(size: number, decimals?: DecimalCount, scaledDecimals?: DecimalCount) {
  if (size === null) {
    return '';
  }

  if (Math.abs(size) < 7) {
    return toFixed(size, decimals) + ' day';
  } else if (Math.abs(size) < 365) {
    return toFixedScaled(size / 7, decimals, scaledDecimals, 2, ' week');
  } else {
    return toFixedScaled(size / 365, decimals, scaledDecimals, 3, ' year');
  }
}

export function toDuration(size: number, decimals: DecimalCount, timeScale: Interval): string {
  if (size === null) {
    return '';
  }

  if (size === 0) {
    return '0 ' + timeScale + 's';
  }

  if (size < 0) {
    return toDuration(-size, decimals, timeScale) + ' ago';
  }

  const units = [
    { long: Interval.Year },
    { long: Interval.Month },
    { long: Interval.Week },
    { long: Interval.Day },
    { long: Interval.Hour },
    { long: Interval.Minute },
    { long: Interval.Second },
    { long: Interval.Millisecond },
  ];

  // convert $size to milliseconds
  // intervals_in_seconds uses seconds (duh), convert them to milliseconds here to minimize floating point errors
  size *= INTERVALS_IN_SECONDS[timeScale] * 1000;

  const strings = [];

  // after first value >= 1 print only $decimals more
  let decrementDecimals = false;
  let decimalsCount = 0;

  if (decimals !== null || decimals !== undefined) {
    decimalsCount = decimals as number;
  }

  for (let i = 0; i < units.length && decimalsCount >= 0; i++) {
    const interval = INTERVALS_IN_SECONDS[units[i].long] * 1000;
    const value = size / interval;
    if (value >= 1 || decrementDecimals) {
      decrementDecimals = true;
      const floor = Math.floor(value);
      const unit = units[i].long + (floor !== 1 ? 's' : '');
      strings.push(floor + ' ' + unit);
      size = size % interval;
      decimalsCount--;
    }
  }

  return strings.join(', ');
}

export function toClock(size: number, decimals?: DecimalCount) {
  if (size === null) {
    return '';
  }

  // < 1 second
  if (size < 1000) {
    return moment.utc(size).format('SSS\\m\\s');
  }

  // < 1 minute
  if (size < 60000) {
    let format = 'ss\\s:SSS\\m\\s';
    if (decimals === 0) {
      format = 'ss\\s';
    }
    return moment.utc(size).format(format);
  }

  // < 1 hour
  if (size < 3600000) {
    let format = 'mm\\m:ss\\s:SSS\\m\\s';
    if (decimals === 0) {
      format = 'mm\\m';
    } else if (decimals === 1) {
      format = 'mm\\m:ss\\s';
    }
    return moment.utc(size).format(format);
  }

  let format = 'mm\\m:ss\\s:SSS\\m\\s';

  const hours = `${('0' + Math.floor(moment.duration(size, 'milliseconds').asHours())).slice(-2)}h`;

  if (decimals === 0) {
    format = '';
  } else if (decimals === 1) {
    format = 'mm\\m';
  } else if (decimals === 2) {
    format = 'mm\\m:ss\\s';
  }

  return format ? `${hours}:${moment.utc(size).format(format)}` : hours;
}

export function toDurationInMilliseconds(size: number, decimals: DecimalCount) {
  return toDuration(size, decimals, Interval.Millisecond);
}

export function toDurationInSeconds(size: number, decimals: DecimalCount) {
  return toDuration(size, decimals, Interval.Second);
}

export function toDurationInHoursMinutesSeconds(size: number) {
  const strings = [];
  const numHours = Math.floor(size / 3600);
  const numMinutes = Math.floor((size % 3600) / 60);
  const numSeconds = Math.floor((size % 3600) % 60);
  numHours > 9 ? strings.push('' + numHours) : strings.push('0' + numHours);
  numMinutes > 9 ? strings.push('' + numMinutes) : strings.push('0' + numMinutes);
  numSeconds > 9 ? strings.push('' + numSeconds) : strings.push('0' + numSeconds);
  return strings.join(':');
}

export function toTimeTicks(size: number, decimals: DecimalCount, scaledDecimals: DecimalCount) {
  return toSeconds(size, decimals, scaledDecimals);
}

export function toClockMilliseconds(size: number, decimals: DecimalCount) {
  return toClock(size, decimals);
}

export function toClockSeconds(size: number, decimals: DecimalCount) {
  return toClock(size * 1000, decimals);
}

export function dateTimeAsIso(value: number, decimals: DecimalCount, scaledDecimals: DecimalCount, isUtc?: boolean) {
  const time = isUtc ? moment.utc(value) : moment(value);

  if (moment().isSame(value, 'day')) {
    return time.format('HH:mm:ss');
  }
  return time.format('YYYY-MM-DD HH:mm:ss');
}

export function dateTimeAsUS(value: number, decimals: DecimalCount, scaledDecimals: DecimalCount, isUtc?: boolean) {
  const time = isUtc ? moment.utc(value) : moment(value);

  if (moment().isSame(value, 'day')) {
    return time.format('h:mm:ss a');
  }
  return time.format('MM/DD/YYYY h:mm:ss a');
}

export function dateTimeFromNow(value: number, decimals: DecimalCount, scaledDecimals: DecimalCount, isUtc?: boolean) {
  const time = isUtc ? moment.utc(value) : moment(value);
  return time.fromNow();
}
