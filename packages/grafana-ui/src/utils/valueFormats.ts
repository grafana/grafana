import moment from 'moment';

type ValueFormatter = (value: number, decimals?: number, scaledDecimals?: number, isUtc?: boolean) => string;

interface ValueFormat {
  name: string;
  id: string;
  fn: ValueFormatter;
}

interface ValueFormatCategory {
  name: string;
  formats: ValueFormat[];
}

interface ValueFormatterIndex {
  [id: string]: ValueFormatter;
}

interface IntervalsInSeconds {
  [interval: string]: number;
}

enum Interval {
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
  [Interval.Month]: 60,
  [Interval.Second]: 1,
  [Interval.Millisecond]: 0.001,
};

// Globals & formats cache
let categories: ValueFormatCategory[] = [];
const index: ValueFormatterIndex = {};
let hasBuildIndex = false;

function toFixed(value: number, decimals?: number): string {
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
}

function toFixedScaled(
  value: number,
  decimals: number,
  scaledDecimals: number,
  additionalDecimals: number,
  ext: string
) {
  if (scaledDecimals === null) {
    return toFixed(value, decimals) + ext;
  } else {
    return toFixed(value, scaledDecimals + additionalDecimals) + ext;
  }
}

function toFixedUnit(unit: string) {
  return (size: number, decimals: number) => {
    if (size === null) {
      return '';
    }
    return toFixed(size, decimals) + ' ' + unit;
  };
}

// Formatter which scales the unit string geometrically according to the given
// numeric factor. Repeatedly scales the value down by the factor until it is
// less than the factor in magnitude, or the end of the array is reached.
function scaledUnits(factor: number, extArray: string[]) {
  return (size: number, decimals: number, scaledDecimals: number) => {
    if (size === null) {
      return '';
    }

    let steps = 0;
    const limit = extArray.length;

    while (Math.abs(size) >= factor) {
      steps++;
      size /= factor;

      if (steps >= limit) {
        return 'NA';
      }
    }

    if (steps > 0 && scaledDecimals !== null) {
      decimals = scaledDecimals + 3 * steps;
    }

    return toFixed(size, decimals) + extArray[steps];
  };
}

function toPercent(size: number, decimals: number) {
  if (size === null) {
    return '';
  }
  return toFixed(size, decimals) + '%';
}

function toPercentUnit(size: number, decimals: number) {
  if (size === null) {
    return '';
  }
  return toFixed(100 * size, decimals) + '%';
}

function toHex0x(value: number, decimals: number) {
  if (value == null) {
    return '';
  }
  const hexString = hex(value, decimals);
  if (hexString.substring(0, 1) === '-') {
    return '-0x' + hexString.substring(1);
  }
  return '0x' + hexString;
}

function hex(value: number, decimals: number) {
  if (value == null) {
    return '';
  }
  return parseFloat(toFixed(value, decimals))
    .toString(16)
    .toUpperCase();
}

function sci(value: number, decimals: number) {
  if (value == null) {
    return '';
  }
  return value.toExponential(decimals);
}

function locale(value: number, decimals: number) {
  if (value == null) {
    return '';
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: decimals });
}

function currency(symbol: string) {
  const units = ['', 'K', 'M', 'B', 'T'];
  const scaler = scaledUnits(1000, units);
  return (size: number, decimals: number, scaledDecimals: number) => {
    if (size === null) {
      return '';
    }
    const scaled = scaler(size, decimals, scaledDecimals);
    return symbol + scaled;
  };
}

function toNanoSeconds(size: number, decimals: number, scaledDecimals: number) {
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

function toMicroSeconds(size: number, decimals: number, scaledDecimals: number) {
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

function toMilliSeconds(size: number, decimals: number, scaledDecimals: number) {
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

function toSeconds(size: number, decimals: number, scaledDecimals: number) {
  if (size === null) {
    return '';
  }

  // Less than 1 µs, divide in ns
  if (Math.abs(size) < 0.000001) {
    return toFixedScaled(size * 1e9, decimals, scaledDecimals - decimals, -9, ' ns');
  }
  // Less than 1 ms, divide in µs
  if (Math.abs(size) < 0.001) {
    return toFixedScaled(size * 1e6, decimals, scaledDecimals - decimals, -6, ' µs');
  }
  // Less than 1 second, divide in ms
  if (Math.abs(size) < 1) {
    return toFixedScaled(size * 1e3, decimals, scaledDecimals - decimals, -3, ' ms');
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

function toMinutes(size: number, decimals: number, scaledDecimals: number) {
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

function toHours(size: number, decimals: number, scaledDecimals: number) {
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

function toDays(size: number, decimals: number, scaledDecimals: number) {
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

function toDuration(size: number, decimals: number, timeScale: Interval): string {
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
  for (let i = 0; i < units.length && decimals >= 0; i++) {
    const interval = INTERVALS_IN_SECONDS[units[i].long] * 1000;
    const value = size / interval;
    if (value >= 1 || decrementDecimals) {
      decrementDecimals = true;
      const floor = Math.floor(value);
      const unit = units[i].long + (floor !== 1 ? 's' : '');
      strings.push(floor + ' ' + unit);
      size = size % interval;
      decimals--;
    }
  }

  return strings.join(', ');
}

function toClock(size: number, decimals: number) {
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

function toDurationInMilliseconds(size: number, decimals: number) {
  return toDuration(size, decimals, Interval.Millisecond);
}

function toDurationInSeconds(size: number, decimals: number) {
  return toDuration(size, decimals, Interval.Second);
}

function toDurationInHoursMinutesSeconds(size: number) {
  const strings = [];
  const numHours = Math.floor(size / 3600);
  const numMinutes = Math.floor((size % 3600) / 60);
  const numSeconds = Math.floor((size % 3600) % 60);
  numHours > 9 ? strings.push('' + numHours) : strings.push('0' + numHours);
  numMinutes > 9 ? strings.push('' + numMinutes) : strings.push('0' + numMinutes);
  numSeconds > 9 ? strings.push('' + numSeconds) : strings.push('0' + numSeconds);
  return strings.join(':');
}

function toTimeTicks(size: number, decimals: number, scaledDecimals: number) {
  return toSeconds(size, decimals, scaledDecimals);
}

function toClockMilliseconds(size: number, decimals: number) {
  return toClock(size, decimals);
}

function toClockSeconds(size: number, decimals: number) {
  return toClock(size * 1000, decimals);
}

function dateTimeAsIso(value: number, decimals: number, scaledDecimals: number, isUtc: boolean) {
  const time = isUtc ? moment.utc(value) : moment(value);

  if (moment().isSame(value, 'day')) {
    return time.format('HH:mm:ss');
  }
  return time.format('YYYY-MM-DD HH:mm:ss');
}

function dateTimeAsUS(value: number, decimals: number, scaledDecimals: number, isUtc: boolean) {
  const time = isUtc ? moment.utc(value) : moment(value);

  if (moment().isSame(value, 'day')) {
    return time.format('h:mm:ss a');
  }
  return time.format('MM/DD/YYYY h:mm:ss a');
}

function dateTimeFromNow(value: number, decimals: number, scaledDecimals: number, isUtc: boolean) {
  const time = isUtc ? moment.utc(value) : moment(value);
  return time.fromNow();
}

function binarySIPrefix(unit: string, offset = 0) {
  const prefixes = ['', 'Ki', 'Mi', 'Gi', 'Ti', 'Pi', 'Ei', 'Zi', 'Yi'].slice(offset);
  const units = prefixes.map(p => {
    return ' ' + p + unit;
  });
  return scaledUnits(1024, units);
}

function decimalSIPrefix(unit: string, offset = 0) {
  let prefixes = ['n', 'µ', 'm', '', 'k', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y'];
  prefixes = prefixes.slice(3 + (offset || 0));
  const units = prefixes.map(p => {
    return ' ' + p + unit;
  });
  return scaledUnits(1000, units);
}

function buildFormats() {
  categories = [
    {
      name: 'none',
      formats: [
        { name: 'none', id: 'none', fn: toFixed },
        {
          name: 'short',
          id: 'short',
          fn: scaledUnits(1000, ['', ' K', ' Mil', ' Bil', ' Tri', ' Quadr', ' Quint', ' Sext', ' Sept']),
        },
        { name: 'percent (0-100)', id: 'percent', fn: toPercent },
        { name: 'percent (0.0-1.0)', id: 'percentunit', fn: toPercentUnit },
        { name: 'Humidity (%H)', id: 'humidity', fn: toFixedUnit('%H') },
        { name: 'decibel', id: 'dB', fn: toFixedUnit('dB') },
        { name: 'hexadecimal (0x)', id: 'hex0x', fn: toHex0x },
        { name: 'hexadecimal', id: 'hex', fn: hex },
        { name: 'scientific notation', id: 'sci', fn: sci },
        { name: 'locale format', id: 'locale', fn: locale },
      ],
    },
    {
      name: 'area',
      formats: [
        { name: 'Square Meters (m²)', id: 'areaM2', fn: toFixedUnit('m²') },
        { name: 'Square Feet (ft²)', id: 'areaF2', fn: toFixedUnit('ft²') },
        { name: 'Square Miles (mi²)', id: 'areaMI2', fn: toFixedUnit('mi²') },
      ],
    },
    {
      name: 'computation throughput',
      formats: [
        { name: 'FLOP/s', id: 'flops', fn: decimalSIPrefix('FLOP/s') },
        { name: 'MFLOP/s', id: 'mflops', fn: decimalSIPrefix('FLOP/s', 2) },
        { name: 'GFLOP/s', id: 'gflops', fn: decimalSIPrefix('FLOP/s', 3) },
        { name: 'TFLOP/s', id: 'tflops', fn: decimalSIPrefix('FLOP/s', 4) },
        { name: 'PFLOP/s', id: 'pflops', fn: decimalSIPrefix('FLOP/s', 5) },
        { name: 'EFLOP/s', id: 'eflops', fn: decimalSIPrefix('FLOP/s', 6) },
      ],
    },
    {
      name: 'currency',
      formats: [
        { name: 'Dollars ($)', id: 'currencyUSD', fn: currency('$') },
        { name: 'Pounds (£)', id: 'currencyGBP', fn: currency('£') },
        { name: 'Euro (€)', id: 'currencyEUR', fn: currency('€') },
        { name: 'Yen (¥)', id: 'currencyJPY', fn: currency('¥') },
        { name: 'Rubles (₽)', id: 'currencyRUB', fn: currency('₽') },
        { name: 'Hryvnias (₴)', id: 'currencyUAH', fn: currency('₴') },
        { name: 'Real (R$)', id: 'currencyBRL', fn: currency('R$') },
        { name: 'Danish Krone (kr)', id: 'currencyDKK', fn: currency('kr') },
        { name: 'Icelandic Króna (kr)', id: 'currencyISK', fn: currency('kr') },
        { name: 'Norwegian Krone (kr)', id: 'currencyNOK', fn: currency('kr') },
        { name: 'Swedish Krona (kr)', id: 'currencySEK', fn: currency('kr') },
        { name: 'Czech koruna (czk)', id: 'currencyCZK', fn: currency('czk') },
        { name: 'Swiss franc (CHF)', id: 'currencyCHF', fn: currency('CHF') },
        { name: 'Polish Złoty (PLN)', id: 'currencyPLN', fn: currency('PLN') },
        { name: 'Bitcoin (฿)', id: 'currencyBTC', fn: currency('฿') },
      ],
    },
    {
      name: 'data (IEC)',
      formats: [
        { name: 'bits', id: 'bits', fn: binarySIPrefix('b') },
        { name: 'bytes', id: 'bytes', fn: binarySIPrefix('B') },
        { name: 'kibibytes', id: 'kbytes', fn: binarySIPrefix('B', 1) },
        { name: 'mebibytes', id: 'mbytes', fn: binarySIPrefix('B', 2) },
        { name: 'gibibytes', id: 'gbytes', fn: binarySIPrefix('B', 3) },
      ],
    },
    {
      name: 'data (Metric)',
      formats: [
        { name: 'bits', id: 'decbits', fn: decimalSIPrefix('d') },
        { name: 'bytes', id: 'decbytes', fn: decimalSIPrefix('B') },
        { name: 'kilobytes', id: 'deckbytes', fn: decimalSIPrefix('B', 1) },
        { name: 'megabytes', id: 'decmbytes', fn: decimalSIPrefix('B', 2) },
        { name: 'gigabytes', id: 'decgbytes', fn: decimalSIPrefix('B', 3) },
      ],
    },
    {
      name: 'data rate',
      formats: [
        { name: 'packets/sec', id: 'pps', fn: decimalSIPrefix('pps') },
        { name: 'bits/sec', id: 'bps', fn: decimalSIPrefix('bps') },
        { name: 'bytes/sec', id: 'Bps', fn: decimalSIPrefix('B/s') },
        { name: 'kilobytes/sec', id: 'KBs', fn: decimalSIPrefix('Bs', 1) },
        { name: 'kilobits/sec', id: 'Kbits', fn: decimalSIPrefix('bps', 1) },
        { name: 'megabytes/sec', id: 'MBs', fn: decimalSIPrefix('Bs', 2) },
        { name: 'megabits/sec', id: 'Mbits', fn: decimalSIPrefix('bps', 2) },
        { name: 'gigabytes/sec', id: 'GBs', fn: decimalSIPrefix('Bs', 3) },
        { name: 'gigabits/sec', id: 'Gbits', fn: decimalSIPrefix('bps', 3) },
      ],
    },
    {
      name: 'date & time',
      formats: [
        { name: 'YYYY-MM-DD HH:mm:ss', id: 'dateTimeAsIso', fn: dateTimeAsIso },
        { name: 'DD/MM/YYYY h:mm:ss a', id: 'dateTimeAsUS', fn: dateTimeAsUS },
        { name: 'From Now', id: 'dateTimeFromNow', fn: dateTimeFromNow },
      ],
    },
    {
      name: 'energy',
      formats: [
        { name: 'Watt (W)', id: 'watt', fn: decimalSIPrefix('W') },
        { name: 'Kilowatt (kW)', id: 'kwatt', fn: decimalSIPrefix('W', 1) },
        { name: 'Milliwatt (mW)', id: 'mwatt', fn: decimalSIPrefix('W', -1) },
        { name: 'Watt per square meter (W/m²)', id: 'Wm2', fn: toFixedUnit('W/m²') },
        { name: 'Volt-ampere (VA)', id: 'voltamp', fn: decimalSIPrefix('VA') },
        { name: 'Kilovolt-ampere (kVA)', id: 'kvoltamp', fn: decimalSIPrefix('VA', 1) },
        { name: 'Volt-ampere reactive (var)', id: 'voltampreact', fn: decimalSIPrefix('var') },
        { name: 'Kilovolt-ampere reactive (kvar)', id: 'kvoltampreact', fn: decimalSIPrefix('var', 1) },
        { name: 'Watt-hour (Wh)', id: 'watth', fn: decimalSIPrefix('Wh') },
        { name: 'Kilowatt-hour (kWh)', id: 'kwatth', fn: decimalSIPrefix('Wh', 1) },
        { name: 'Kilowatt-min (kWm)', id: 'kwattm', fn: decimalSIPrefix('W/Min', 1) },
        { name: 'Joule (J)', id: 'joule', fn: decimalSIPrefix('J') },
        { name: 'Electron volt (eV)', id: 'ev', fn: decimalSIPrefix('eV') },
        { name: 'Ampere (A)', id: 'amp', fn: decimalSIPrefix('A') },
        { name: 'Kiloampere (kA)', id: 'kamp', fn: decimalSIPrefix('A', 1) },
        { name: 'Milliampere (mA)', id: 'mamp', fn: decimalSIPrefix('A', -1) },
        { name: 'Volt (V)', id: 'volt', fn: decimalSIPrefix('V') },
        { name: 'Kilovolt (kV)', id: 'kvolt', fn: decimalSIPrefix('V', 1) },
        { name: 'Millivolt (mV)', id: 'mvolt', fn: decimalSIPrefix('V', -1) },
        { name: 'Decibel-milliwatt (dBm)', id: 'dBm', fn: decimalSIPrefix('dBm') },
        { name: 'Ohm (Ω)', id: 'ohm', fn: decimalSIPrefix('Ω') },
        { name: 'Lumens (Lm)', id: 'lumens', fn: decimalSIPrefix('Lm') },
      ],
    },
    {
      name: 'hash rate',
      formats: [
        { name: 'hashes/sec', id: 'Hs', fn: decimalSIPrefix('H/s') },
        { name: 'kilohashes/sec', id: 'KHs', fn: decimalSIPrefix('H/s', 1) },
        { name: 'megahashes/sec', id: 'MHs', fn: decimalSIPrefix('H/s', 2) },
        { name: 'gigahashes/sec', id: 'GHs', fn: decimalSIPrefix('H/s', 3) },
        { name: 'terahashes/sec', id: 'THs', fn: decimalSIPrefix('H/s', 4) },
        { name: 'petahashes/sec', id: 'PHs', fn: decimalSIPrefix('H/s', 5) },
        { name: 'exahashes/sec', id: 'EHs', fn: decimalSIPrefix('H/s', 6) },
      ],
    },
    {
      name: 'mass',
      formats: [
        { name: 'milligram (mg)', id: 'massmg', fn: decimalSIPrefix('g', -1) },
        { name: 'gram (g)', id: 'massg', fn: decimalSIPrefix('g') },
        { name: 'kilogram (kg)', id: 'masskg', fn: decimalSIPrefix('g', 1) },
        { name: 'metric ton (t)', id: 'masst', fn: toFixedUnit('t') },
      ],
    },
    {
      name: 'length',
      formats: [
        { name: 'millimetre (mm)', id: 'lengthmm', fn: decimalSIPrefix('m', -1) },
        { name: 'feet (ft)', id: 'lengthft', fn: toFixedUnit('ft') },
        { name: 'meter (m)', id: 'lengthm', fn: decimalSIPrefix('m') },
        { name: 'kilometer (km)', id: 'lengthkm', fn: decimalSIPrefix('m', 1) },
        { name: 'mile (mi)', id: 'lengthmi', fn: toFixedUnit('mi') },
      ],
    },
    {
      name: 'temperature',
      formats: [
        { name: 'Celsius (°C)', id: 'celsius', fn: toFixedUnit('°C') },
        { name: 'Farenheit (°F)', id: 'farenheit', fn: toFixedUnit('°F') },
        { name: 'Kelvin (K)', id: 'kelvin', fn: toFixedUnit('K') },
      ],
    },
    {
      name: 'time',
      formats: [
        { name: 'Hertz (1/s)', id: 'hertz', fn: decimalSIPrefix('Hz') },
        { name: 'nanoseconds (ns)', id: 'ns', fn: toNanoSeconds },
        { name: 'microseconds (µs)', id: 'µs', fn: toMicroSeconds },
        { name: 'milliseconds (ms)', id: 'ms', fn: toMilliSeconds },
        { name: 'seconds (s)', id: 's', fn: toSeconds },
        { name: 'minutes (m)', id: 'm', fn: toMinutes },
        { name: 'hours (h)', id: 'h', fn: toHours },
        { name: 'days (d)', id: 'd', fn: toDays },
        { name: 'duration (ms)', id: 'dtdurationms', fn: toDurationInMilliseconds },
        { name: 'duration (s)', id: 'dtdurations', fn: toDurationInSeconds },
        { name: 'duration (hh:mm:ss)', id: 'dthms', fn: toDurationInHoursMinutesSeconds },
        { name: 'Timeticks (s/100)', id: 'timeticks', fn: toTimeTicks },
        { name: 'clock (ms)', id: 'clockms', fn: toClockMilliseconds },
        { name: 'clock (s)', id: 'clocks', fn: toClockSeconds },
      ],
    },
    {
      name: 'throughput',
      formats: [
        { name: 'ops/sec (ops)', id: 'ops', fn: decimalSIPrefix('ops') },
        { name: 'requests/sec (rps)', id: 'reqps', fn: decimalSIPrefix('reqps') },
        { name: 'reads/sec (rps)', id: 'rps', fn: decimalSIPrefix('rps') },
        { name: 'writes/sec (wps)', id: 'wps', fn: decimalSIPrefix('wps') },
        { name: 'I/O ops/sec (iops)', id: 'iops', fn: decimalSIPrefix('iops') },
        { name: 'ops/min (opm)', id: 'opm', fn: decimalSIPrefix('opm') },
        { name: 'reads/min (rpm)', id: 'rpm', fn: decimalSIPrefix('rpm') },
        { name: 'writes/min (wpm)', id: 'wpm', fn: decimalSIPrefix('wpm') },
      ],
    },
    {
      name: 'volume',
      formats: [
        { name: 'millilitre (mL)', id: 'mlitre', fn: decimalSIPrefix('L', -1) },
        { name: 'litre (L)', id: 'litre', fn: decimalSIPrefix('L') },
        { name: 'cubic metre', id: 'm3', fn: toFixedUnit('m³') },
        { name: 'Normal cubic metre', id: 'Nm3', fn: toFixedUnit('Nm³') },
        { name: 'cubic decimetre', id: 'dm3', fn: toFixedUnit('dm³') },
        { name: 'gallons', id: 'gallons', fn: toFixedUnit('gal') },
      ],
    },
  ];

  for (const cat of categories) {
    for (const format of cat.formats) {
      index[format.id] = format.fn;
    }
  }

  hasBuildIndex = true;
}

export function getValueFormat(id: string): ValueFormatter {
  if (!hasBuildIndex) {
    buildFormats();
  }

  return index[id];
}

export function getValueFormatterIndex(): ValueFormatterIndex {
  if (!hasBuildIndex) {
    buildFormats();
  }

  return index;
}

export function getUnitFormats() {
  if (!hasBuildIndex) {
    buildFormats();
  }

  return categories.map(cat => {
    return {
      text: cat.name,
      submenu: cat.formats.map(format => {
        return {
          text: format.name,
          id: format.id,
        };
      }),
    };
  });
}
