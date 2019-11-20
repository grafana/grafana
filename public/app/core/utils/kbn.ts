import { has } from 'lodash';
import {
  getValueFormat,
  getValueFormatterIndex,
  getValueFormats,
  stringToJsRegex,
  TimeRange,
  deprecationWarning,
} from '@grafana/data';

const kbn: any = {};

kbn.valueFormats = {};

kbn.regexEscape = (value: string) => {
  return value.replace(/[\\^$*+?.()|[\]{}\/]/g, '\\$&');
};

///// HELPER FUNCTIONS /////

kbn.round_interval = (interval: number) => {
  switch (true) {
    // 0.015s
    case interval < 15:
      return 10; // 0.01s
    // 0.035s
    case interval < 35:
      return 20; // 0.02s
    // 0.075s
    case interval < 75:
      return 50; // 0.05s
    // 0.15s
    case interval < 150:
      return 100; // 0.1s
    // 0.35s
    case interval < 350:
      return 200; // 0.2s
    // 0.75s
    case interval < 750:
      return 500; // 0.5s
    // 1.5s
    case interval < 1500:
      return 1000; // 1s
    // 3.5s
    case interval < 3500:
      return 2000; // 2s
    // 7.5s
    case interval < 7500:
      return 5000; // 5s
    // 12.5s
    case interval < 12500:
      return 10000; // 10s
    // 17.5s
    case interval < 17500:
      return 15000; // 15s
    // 25s
    case interval < 25000:
      return 20000; // 20s
    // 45s
    case interval < 45000:
      return 30000; // 30s
    // 1.5m
    case interval < 90000:
      return 60000; // 1m
    // 3.5m
    case interval < 210000:
      return 120000; // 2m
    // 7.5m
    case interval < 450000:
      return 300000; // 5m
    // 12.5m
    case interval < 750000:
      return 600000; // 10m
    // 12.5m
    case interval < 1050000:
      return 900000; // 15m
    // 25m
    case interval < 1500000:
      return 1200000; // 20m
    // 45m
    case interval < 2700000:
      return 1800000; // 30m
    // 1.5h
    case interval < 5400000:
      return 3600000; // 1h
    // 2.5h
    case interval < 9000000:
      return 7200000; // 2h
    // 4.5h
    case interval < 16200000:
      return 10800000; // 3h
    // 9h
    case interval < 32400000:
      return 21600000; // 6h
    // 1d
    case interval < 86400000:
      return 43200000; // 12h
    // 1w
    case interval < 604800000:
      return 86400000; // 1d
    // 3w
    case interval < 1814400000:
      return 604800000; // 1w
    // 6w
    case interval < 3628800000:
      return 2592000000; // 30d
    default:
      return 31536000000; // 1y
  }
};

kbn.secondsToHms = (seconds: number) => {
  const numyears = Math.floor(seconds / 31536000);
  if (numyears) {
    return numyears + 'y';
  }
  const numdays = Math.floor((seconds % 31536000) / 86400);
  if (numdays) {
    return numdays + 'd';
  }
  const numhours = Math.floor(((seconds % 31536000) % 86400) / 3600);
  if (numhours) {
    return numhours + 'h';
  }
  const numminutes = Math.floor((((seconds % 31536000) % 86400) % 3600) / 60);
  if (numminutes) {
    return numminutes + 'm';
  }
  const numseconds = Math.floor((((seconds % 31536000) % 86400) % 3600) % 60);
  if (numseconds) {
    return numseconds + 's';
  }
  const nummilliseconds = Math.floor(seconds * 1000.0);
  if (nummilliseconds) {
    return nummilliseconds + 'ms';
  }

  return 'less than a millisecond'; //'just now' //or other string you like;
};

kbn.secondsToHhmmss = (seconds: number) => {
  const strings: string[] = [];
  const numhours = Math.floor(seconds / 3600);
  const numminutes = Math.floor((seconds % 3600) / 60);
  const numseconds = Math.floor((seconds % 3600) % 60);
  numhours > 9 ? strings.push('' + numhours) : strings.push('0' + numhours);
  numminutes > 9 ? strings.push('' + numminutes) : strings.push('0' + numminutes);
  numseconds > 9 ? strings.push('' + numseconds) : strings.push('0' + numseconds);
  return strings.join(':');
};

kbn.to_percent = (nr: number, outof: number) => {
  return Math.floor((nr / outof) * 10000) / 100 + '%';
};

kbn.addslashes = (str: string) => {
  str = str.replace(/\\/g, '\\\\');
  str = str.replace(/\'/g, "\\'");
  str = str.replace(/\"/g, '\\"');
  str = str.replace(/\0/g, '\\0');
  return str;
};

kbn.interval_regex = /(\d+(?:\.\d+)?)(ms|[Mwdhmsy])/;

// histogram & trends
kbn.intervals_in_seconds = {
  y: 31536000,
  M: 2592000,
  w: 604800,
  d: 86400,
  h: 3600,
  m: 60,
  s: 1,
  ms: 0.001,
};

kbn.calculateInterval = (range: TimeRange, resolution: number, lowLimitInterval: string[]) => {
  let lowLimitMs = 1; // 1 millisecond default low limit
  let intervalMs;

  if (lowLimitInterval) {
    if (lowLimitInterval[0] === '>') {
      lowLimitInterval = lowLimitInterval.slice(1);
    }
    lowLimitMs = kbn.interval_to_ms(lowLimitInterval);
  }

  intervalMs = kbn.round_interval((range.to.valueOf() - range.from.valueOf()) / resolution);
  if (lowLimitMs > intervalMs) {
    intervalMs = lowLimitMs;
  }

  return {
    intervalMs: intervalMs,
    interval: kbn.secondsToHms(intervalMs / 1000),
  };
};

kbn.describe_interval = (str: string) => {
  const matches = str.match(kbn.interval_regex);
  if (!matches || !has(kbn.intervals_in_seconds, matches[2])) {
    throw new Error('Invalid interval string, expecting a number followed by one of "Mwdhmsy"');
  } else {
    return {
      sec: kbn.intervals_in_seconds[matches[2]],
      type: matches[2],
      count: parseInt(matches[1], 10),
    };
  }
};

kbn.interval_to_ms = (str: string) => {
  const info = kbn.describe_interval(str);
  return info.sec * 1000 * info.count;
};

kbn.interval_to_seconds = (str: string) => {
  const info = kbn.describe_interval(str);
  return info.sec * info.count;
};

kbn.query_color_dot = (color: string, diameter: string) => {
  return (
    '<div class="icon-circle" style="' +
    ['display:inline-block', 'color:' + color, 'font-size:' + diameter + 'px'].join(';') +
    '"></div>'
  );
};

kbn.slugifyForUrl = (str: string) => {
  return str
    .toLowerCase()
    .replace(/[^\w ]+/g, '')
    .replace(/ +/g, '-');
};

/** deprecated since 6.1, use grafana/data */
kbn.stringToJsRegex = (str: string) => {
  deprecationWarning('kbn.ts', 'kbn.stringToJsRegex()', '@grafana/data');
  return stringToJsRegex(str);
};

kbn.toFixed = (value: number | null, decimals: number) => {
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
      return (precision ? formatted : formatted + '.') + String(factor).substr(1, decimals - precision);
    }
  }

  return formatted;
};

kbn.toFixedScaled = (
  value: number,
  decimals: number,
  scaledDecimals: number | null,
  additionalDecimals: number,
  ext: number
) => {
  if (scaledDecimals === null) {
    return kbn.toFixed(value, decimals) + ext;
  } else {
    return kbn.toFixed(value, scaledDecimals + additionalDecimals) + ext;
  }
};

kbn.roundValue = (num: number, decimals: number) => {
  if (num === null) {
    return null;
  }
  const n = Math.pow(10, decimals);
  const formatted = (n * num).toFixed(decimals);
  return Math.round(parseFloat(formatted)) / n;
};

///// FORMAT MENU /////

kbn.getUnitFormats = () => {
  return getValueFormats();
};

//
// Backward compatible layer for value formats to support old plugins
//
if (typeof Proxy !== 'undefined') {
  kbn.valueFormats = new Proxy(kbn.valueFormats, {
    get(target, name, receiver) {
      if (typeof name !== 'string') {
        throw { message: `Value format ${String(name)} is not a string` };
      }

      const formatter = getValueFormat(name);
      if (formatter) {
        return formatter;
      }

      // default to look here
      return Reflect.get(target, name, receiver);
    },
  });
} else {
  kbn.valueFormats = getValueFormatterIndex();
}

export default kbn;
