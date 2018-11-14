import _ from 'lodash';
import moment from 'moment';

const kbn: any = {};

kbn.valueFormats = {};

kbn.regexEscape = value => {
  return value.replace(/[\\^$*+?.()|[\]{}\/]/g, '\\$&');
};

///// HELPER FUNCTIONS /////

kbn.round_interval = interval => {
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

kbn.secondsToHms = seconds => {
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

kbn.secondsToHhmmss = seconds => {
  const strings = [];
  const numhours = Math.floor(seconds / 3600);
  const numminutes = Math.floor((seconds % 3600) / 60);
  const numseconds = Math.floor((seconds % 3600) % 60);
  numhours > 9 ? strings.push('' + numhours) : strings.push('0' + numhours);
  numminutes > 9 ? strings.push('' + numminutes) : strings.push('0' + numminutes);
  numseconds > 9 ? strings.push('' + numseconds) : strings.push('0' + numseconds);
  return strings.join(':');
};

kbn.to_percent = (nr, outof) => {
  return Math.floor(nr / outof * 10000) / 100 + '%';
};

kbn.addslashes = str => {
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

kbn.calculateInterval = (range, resolution, lowLimitInterval) => {
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

kbn.describe_interval = str => {
  const matches = str.match(kbn.interval_regex);
  if (!matches || !_.has(kbn.intervals_in_seconds, matches[2])) {
    throw new Error('Invalid interval string, expecting a number followed by one of "Mwdhmsy"');
  } else {
    return {
      sec: kbn.intervals_in_seconds[matches[2]],
      type: matches[2],
      count: parseInt(matches[1], 10),
    };
  }
};

kbn.interval_to_ms = str => {
  const info = kbn.describe_interval(str);
  return info.sec * 1000 * info.count;
};

kbn.interval_to_seconds = str => {
  const info = kbn.describe_interval(str);
  return info.sec * info.count;
};

kbn.query_color_dot = (color, diameter) => {
  return (
    '<div class="icon-circle" style="' +
    ['display:inline-block', 'color:' + color, 'font-size:' + diameter + 'px'].join(';') +
    '"></div>'
  );
};

kbn.slugifyForUrl = str => {
  return str
    .toLowerCase()
    .replace(/[^\w ]+/g, '')
    .replace(/ +/g, '-');
};

kbn.stringToJsRegex = str => {
  if (str[0] !== '/') {
    return new RegExp('^' + str + '$');
  }

  const match = str.match(new RegExp('^/(.*?)/(g?i?m?y?)$'));
  return new RegExp(match[1], match[2]);
};

kbn.toFixed = (value, decimals) => {
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

kbn.toFixedScaled = (value, decimals, scaledDecimals, additionalDecimals, ext) => {
  if (scaledDecimals === null) {
    return kbn.toFixed(value, decimals) + ext;
  } else {
    return kbn.toFixed(value, scaledDecimals + additionalDecimals) + ext;
  }
};

kbn.roundValue = (num, decimals) => {
  if (num === null) {
    return null;
  }
  const n = Math.pow(10, decimals);
  const formatted = (n * num).toFixed(decimals);
  return Math.round(parseFloat(formatted)) / n;
};

///// FORMAT FUNCTION CONSTRUCTORS /////

kbn.formatBuilders = {};

// Formatter which always appends a fixed unit string to the value. No
// scaling of the value is performed.
kbn.formatBuilders.fixedUnit = unit => {
  return (size, decimals) => {
    if (size === null) {
      return '';
    }
    return kbn.toFixed(size, decimals) + ' ' + unit;
  };
};

// Formatter which scales the unit string geometrically according to the given
// numeric factor. Repeatedly scales the value down by the factor until it is
// less than the factor in magnitude, or the end of the array is reached.
kbn.formatBuilders.scaledUnits = (factor, extArray) => {
  return (size, decimals, scaledDecimals) => {
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

    return kbn.toFixed(size, decimals) + extArray[steps];
  };
};

// Extension of the scaledUnits builder which uses SI decimal prefixes. If an
// offset is given, it adjusts the starting units at the given prefix; a value
// of 0 starts at no scale; -3 drops to nano, +2 starts at mega, etc.
kbn.formatBuilders.decimalSIPrefix = (unit, offset) => {
  let prefixes = ['n', 'µ', 'm', '', 'k', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y'];
  prefixes = prefixes.slice(3 + (offset || 0));
  const units = prefixes.map(p => {
    return ' ' + p + unit;
  });
  return kbn.formatBuilders.scaledUnits(1000, units);
};

// Extension of the scaledUnits builder which uses SI binary prefixes. If
// offset is given, it starts the units at the given prefix; otherwise, the
// offset defaults to zero and the initial unit is not prefixed.
kbn.formatBuilders.binarySIPrefix = (unit, offset) => {
  const prefixes = ['', 'Ki', 'Mi', 'Gi', 'Ti', 'Pi', 'Ei', 'Zi', 'Yi'].slice(offset);
  const units = prefixes.map(p => {
    return ' ' + p + unit;
  });
  return kbn.formatBuilders.scaledUnits(1024, units);
};

// Currency formatter for prefixing a symbol onto a number. Supports scaling
// up to the trillions.
kbn.formatBuilders.currency = symbol => {
  const units = ['', 'K', 'M', 'B', 'T'];
  const scaler = kbn.formatBuilders.scaledUnits(1000, units);
  return (size, decimals, scaledDecimals) => {
    if (size === null) {
      return '';
    }
    const scaled = scaler(size, decimals, scaledDecimals);
    return symbol + scaled;
  };
};

kbn.formatBuilders.simpleCountUnit = symbol => {
  const units = ['', 'K', 'M', 'B', 'T'];
  const scaler = kbn.formatBuilders.scaledUnits(1000, units);
  return (size, decimals, scaledDecimals) => {
    if (size === null) {
      return '';
    }
    const scaled = scaler(size, decimals, scaledDecimals);
    return scaled + ' ' + symbol;
  };
};

///// VALUE FORMATS /////

// Dimensionless Units
kbn.valueFormats.none = kbn.toFixed;
kbn.valueFormats.short = kbn.formatBuilders.scaledUnits(1000, [
  '',
  ' K',
  ' Mil',
  ' Bil',
  ' Tri',
  ' Quadr',
  ' Quint',
  ' Sext',
  ' Sept',
]);
kbn.valueFormats.dB = kbn.formatBuilders.fixedUnit('dB');

kbn.valueFormats.percent = (size, decimals) => {
  if (size === null) {
    return '';
  }
  return kbn.toFixed(size, decimals) + '%';
};

kbn.valueFormats.percentunit = (size, decimals) => {
  if (size === null) {
    return '';
  }
  return kbn.toFixed(100 * size, decimals) + '%';
};

/* Formats the value to hex. Uses float if specified decimals are not 0.
 * There are two options, one with 0x, and one without */

kbn.valueFormats.hex = (value, decimals) => {
  if (value == null) {
    return '';
  }
  return parseFloat(kbn.toFixed(value, decimals))
    .toString(16)
    .toUpperCase();
};

kbn.valueFormats.hex0x = (value, decimals) => {
  if (value == null) {
    return '';
  }
  const hexString = kbn.valueFormats.hex(value, decimals);
  if (hexString.substring(0, 1) === '-') {
    return '-0x' + hexString.substring(1);
  }
  return '0x' + hexString;
};

kbn.valueFormats.sci = (value, decimals) => {
  return value.toExponential(decimals);
};

kbn.valueFormats.locale = (value, decimals) => {
  return value.toLocaleString(undefined, { maximumFractionDigits: decimals });
};

// Currencies
kbn.valueFormats.currencyUSD = kbn.formatBuilders.currency('$');
kbn.valueFormats.currencyGBP = kbn.formatBuilders.currency('£');
kbn.valueFormats.currencyEUR = kbn.formatBuilders.currency('€');
kbn.valueFormats.currencyJPY = kbn.formatBuilders.currency('¥');
kbn.valueFormats.currencyRUB = kbn.formatBuilders.currency('₽');
kbn.valueFormats.currencyUAH = kbn.formatBuilders.currency('₴');
kbn.valueFormats.currencyBRL = kbn.formatBuilders.currency('R$');
kbn.valueFormats.currencyDKK = kbn.formatBuilders.currency('kr');
kbn.valueFormats.currencyISK = kbn.formatBuilders.currency('kr');
kbn.valueFormats.currencyNOK = kbn.formatBuilders.currency('kr');
kbn.valueFormats.currencySEK = kbn.formatBuilders.currency('kr');
kbn.valueFormats.currencyCZK = kbn.formatBuilders.currency('czk');
kbn.valueFormats.currencyCHF = kbn.formatBuilders.currency('CHF');
kbn.valueFormats.currencyPLN = kbn.formatBuilders.currency('zł');
kbn.valueFormats.currencyBTC = kbn.formatBuilders.currency('฿');

// Data (Binary)
kbn.valueFormats.bits = kbn.formatBuilders.binarySIPrefix('b');
kbn.valueFormats.bytes = kbn.formatBuilders.binarySIPrefix('B');
kbn.valueFormats.kbytes = kbn.formatBuilders.binarySIPrefix('B', 1);
kbn.valueFormats.mbytes = kbn.formatBuilders.binarySIPrefix('B', 2);
kbn.valueFormats.gbytes = kbn.formatBuilders.binarySIPrefix('B', 3);

// Data (Decimal)
kbn.valueFormats.decbits = kbn.formatBuilders.decimalSIPrefix('b');
kbn.valueFormats.decbytes = kbn.formatBuilders.decimalSIPrefix('B');
kbn.valueFormats.deckbytes = kbn.formatBuilders.decimalSIPrefix('B', 1);
kbn.valueFormats.decmbytes = kbn.formatBuilders.decimalSIPrefix('B', 2);
kbn.valueFormats.decgbytes = kbn.formatBuilders.decimalSIPrefix('B', 3);

// Data Rate
kbn.valueFormats.pps = kbn.formatBuilders.decimalSIPrefix('pps');
kbn.valueFormats.bps = kbn.formatBuilders.decimalSIPrefix('bps');
kbn.valueFormats.Bps = kbn.formatBuilders.decimalSIPrefix('B/s');
kbn.valueFormats.KBs = kbn.formatBuilders.decimalSIPrefix('Bs', 1);
kbn.valueFormats.Kbits = kbn.formatBuilders.decimalSIPrefix('bps', 1);
kbn.valueFormats.MBs = kbn.formatBuilders.decimalSIPrefix('Bs', 2);
kbn.valueFormats.Mbits = kbn.formatBuilders.decimalSIPrefix('bps', 2);
kbn.valueFormats.GBs = kbn.formatBuilders.decimalSIPrefix('Bs', 3);
kbn.valueFormats.Gbits = kbn.formatBuilders.decimalSIPrefix('bps', 3);

// Hash Rate
kbn.valueFormats.Hs = kbn.formatBuilders.decimalSIPrefix('H/s');
kbn.valueFormats.KHs = kbn.formatBuilders.decimalSIPrefix('H/s', 1);
kbn.valueFormats.MHs = kbn.formatBuilders.decimalSIPrefix('H/s', 2);
kbn.valueFormats.GHs = kbn.formatBuilders.decimalSIPrefix('H/s', 3);
kbn.valueFormats.THs = kbn.formatBuilders.decimalSIPrefix('H/s', 4);
kbn.valueFormats.PHs = kbn.formatBuilders.decimalSIPrefix('H/s', 5);
kbn.valueFormats.EHs = kbn.formatBuilders.decimalSIPrefix('H/s', 6);

// Throughput
kbn.valueFormats.ops = kbn.formatBuilders.simpleCountUnit('ops');
kbn.valueFormats.reqps = kbn.formatBuilders.simpleCountUnit('reqps');
kbn.valueFormats.rps = kbn.formatBuilders.simpleCountUnit('rps');
kbn.valueFormats.wps = kbn.formatBuilders.simpleCountUnit('wps');
kbn.valueFormats.iops = kbn.formatBuilders.simpleCountUnit('iops');
kbn.valueFormats.opm = kbn.formatBuilders.simpleCountUnit('opm');
kbn.valueFormats.rpm = kbn.formatBuilders.simpleCountUnit('rpm');
kbn.valueFormats.wpm = kbn.formatBuilders.simpleCountUnit('wpm');

// Energy
kbn.valueFormats.watt = kbn.formatBuilders.decimalSIPrefix('W');
kbn.valueFormats.kwatt = kbn.formatBuilders.decimalSIPrefix('W', 1);
kbn.valueFormats.mwatt = kbn.formatBuilders.decimalSIPrefix('W', -1);
kbn.valueFormats.kwattm = kbn.formatBuilders.decimalSIPrefix('W/Min', 1);
kbn.valueFormats.Wm2 = kbn.formatBuilders.fixedUnit('W/m²');
kbn.valueFormats.voltamp = kbn.formatBuilders.decimalSIPrefix('VA');
kbn.valueFormats.kvoltamp = kbn.formatBuilders.decimalSIPrefix('VA', 1);
kbn.valueFormats.voltampreact = kbn.formatBuilders.decimalSIPrefix('var');
kbn.valueFormats.kvoltampreact = kbn.formatBuilders.decimalSIPrefix('var', 1);
kbn.valueFormats.watth = kbn.formatBuilders.decimalSIPrefix('Wh');
kbn.valueFormats.kwatth = kbn.formatBuilders.decimalSIPrefix('Wh', 1);
kbn.valueFormats.joule = kbn.formatBuilders.decimalSIPrefix('J');
kbn.valueFormats.ev = kbn.formatBuilders.decimalSIPrefix('eV');
kbn.valueFormats.amp = kbn.formatBuilders.decimalSIPrefix('A');
kbn.valueFormats.kamp = kbn.formatBuilders.decimalSIPrefix('A', 1);
kbn.valueFormats.mamp = kbn.formatBuilders.decimalSIPrefix('A', -1);
kbn.valueFormats.volt = kbn.formatBuilders.decimalSIPrefix('V');
kbn.valueFormats.kvolt = kbn.formatBuilders.decimalSIPrefix('V', 1);
kbn.valueFormats.mvolt = kbn.formatBuilders.decimalSIPrefix('V', -1);
kbn.valueFormats.dBm = kbn.formatBuilders.decimalSIPrefix('dBm');
kbn.valueFormats.ohm = kbn.formatBuilders.decimalSIPrefix('Ω');
kbn.valueFormats.lumens = kbn.formatBuilders.decimalSIPrefix('Lm');

// Temperature
kbn.valueFormats.celsius = kbn.formatBuilders.fixedUnit('°C');
kbn.valueFormats.farenheit = kbn.formatBuilders.fixedUnit('°F');
kbn.valueFormats.kelvin = kbn.formatBuilders.fixedUnit('K');
kbn.valueFormats.humidity = kbn.formatBuilders.fixedUnit('%H');

// Pressure
kbn.valueFormats.pressurebar = kbn.formatBuilders.decimalSIPrefix('bar');
kbn.valueFormats.pressurembar = kbn.formatBuilders.decimalSIPrefix('bar', -1);
kbn.valueFormats.pressurekbar = kbn.formatBuilders.decimalSIPrefix('bar', 1);
kbn.valueFormats.pressurehpa = kbn.formatBuilders.fixedUnit('hPa');
kbn.valueFormats.pressurekpa = kbn.formatBuilders.fixedUnit('kPa');
kbn.valueFormats.pressurehg = kbn.formatBuilders.fixedUnit('"Hg');
kbn.valueFormats.pressurepsi = kbn.formatBuilders.scaledUnits(1000, [' psi', ' ksi', ' Mpsi']);

// Force
kbn.valueFormats.forceNm = kbn.formatBuilders.decimalSIPrefix('Nm');
kbn.valueFormats.forcekNm = kbn.formatBuilders.decimalSIPrefix('Nm', 1);
kbn.valueFormats.forceN = kbn.formatBuilders.decimalSIPrefix('N');
kbn.valueFormats.forcekN = kbn.formatBuilders.decimalSIPrefix('N', 1);

// Length
kbn.valueFormats.lengthm = kbn.formatBuilders.decimalSIPrefix('m');
kbn.valueFormats.lengthmm = kbn.formatBuilders.decimalSIPrefix('m', -1);
kbn.valueFormats.lengthkm = kbn.formatBuilders.decimalSIPrefix('m', 1);
kbn.valueFormats.lengthmi = kbn.formatBuilders.fixedUnit('mi');
kbn.valueFormats.lengthft = kbn.formatBuilders.fixedUnit('ft');

// Area
kbn.valueFormats.areaM2 = kbn.formatBuilders.fixedUnit('m²');
kbn.valueFormats.areaF2 = kbn.formatBuilders.fixedUnit('ft²');
kbn.valueFormats.areaMI2 = kbn.formatBuilders.fixedUnit('mi²');

// Mass
kbn.valueFormats.massmg = kbn.formatBuilders.decimalSIPrefix('g', -1);
kbn.valueFormats.massg = kbn.formatBuilders.decimalSIPrefix('g');
kbn.valueFormats.masskg = kbn.formatBuilders.decimalSIPrefix('g', 1);
kbn.valueFormats.masst = kbn.formatBuilders.fixedUnit('t');

// Velocity
kbn.valueFormats.velocityms = kbn.formatBuilders.fixedUnit('m/s');
kbn.valueFormats.velocitykmh = kbn.formatBuilders.fixedUnit('km/h');
kbn.valueFormats.velocitymph = kbn.formatBuilders.fixedUnit('mph');
kbn.valueFormats.velocityknot = kbn.formatBuilders.fixedUnit('kn');

// Acceleration
kbn.valueFormats.accMS2 = kbn.formatBuilders.fixedUnit('m/sec²');
kbn.valueFormats.accFS2 = kbn.formatBuilders.fixedUnit('f/sec²');
kbn.valueFormats.accG = kbn.formatBuilders.fixedUnit('g');

// Volume
kbn.valueFormats.litre = kbn.formatBuilders.decimalSIPrefix('L');
kbn.valueFormats.mlitre = kbn.formatBuilders.decimalSIPrefix('L', -1);
kbn.valueFormats.m3 = kbn.formatBuilders.fixedUnit('m³');
kbn.valueFormats.Nm3 = kbn.formatBuilders.fixedUnit('Nm³');
kbn.valueFormats.dm3 = kbn.formatBuilders.fixedUnit('dm³');
kbn.valueFormats.gallons = kbn.formatBuilders.fixedUnit('gal');

// Flow
kbn.valueFormats.flowgpm = kbn.formatBuilders.fixedUnit('gpm');
kbn.valueFormats.flowcms = kbn.formatBuilders.fixedUnit('cms');
kbn.valueFormats.flowcfs = kbn.formatBuilders.fixedUnit('cfs');
kbn.valueFormats.flowcfm = kbn.formatBuilders.fixedUnit('cfm');
kbn.valueFormats.litreh = kbn.formatBuilders.fixedUnit('l/h');
kbn.valueFormats.flowlpm = kbn.formatBuilders.decimalSIPrefix('L');
kbn.valueFormats.flowmlpm = kbn.formatBuilders.decimalSIPrefix('L', -1);

// Angle
kbn.valueFormats.degree = kbn.formatBuilders.fixedUnit('°');
kbn.valueFormats.radian = kbn.formatBuilders.fixedUnit('rad');
kbn.valueFormats.grad = kbn.formatBuilders.fixedUnit('grad');

// Radiation
kbn.valueFormats.radbq = kbn.formatBuilders.decimalSIPrefix('Bq');
kbn.valueFormats.radci = kbn.formatBuilders.decimalSIPrefix('Ci');
kbn.valueFormats.radgy = kbn.formatBuilders.decimalSIPrefix('Gy');
kbn.valueFormats.radrad = kbn.formatBuilders.decimalSIPrefix('rad');
kbn.valueFormats.radsv = kbn.formatBuilders.decimalSIPrefix('Sv');
kbn.valueFormats.radrem = kbn.formatBuilders.decimalSIPrefix('rem');
kbn.valueFormats.radexpckg = kbn.formatBuilders.decimalSIPrefix('C/kg');
kbn.valueFormats.radr = kbn.formatBuilders.decimalSIPrefix('R');
kbn.valueFormats.radsvh = kbn.formatBuilders.decimalSIPrefix('Sv/h');

// Concentration
kbn.valueFormats.ppm = kbn.formatBuilders.fixedUnit('ppm');
kbn.valueFormats.conppb = kbn.formatBuilders.fixedUnit('ppb');
kbn.valueFormats.conngm3 = kbn.formatBuilders.fixedUnit('ng/m³');
kbn.valueFormats.conngNm3 = kbn.formatBuilders.fixedUnit('ng/Nm³');
kbn.valueFormats.conμgm3 = kbn.formatBuilders.fixedUnit('μg/m³');
kbn.valueFormats.conμgNm3 = kbn.formatBuilders.fixedUnit('μg/Nm³');
kbn.valueFormats.conmgm3 = kbn.formatBuilders.fixedUnit('mg/m³');
kbn.valueFormats.conmgNm3 = kbn.formatBuilders.fixedUnit('mg/Nm³');
kbn.valueFormats.congm3 = kbn.formatBuilders.fixedUnit('g/m³');
kbn.valueFormats.congNm3 = kbn.formatBuilders.fixedUnit('g/Nm³');

// Time
kbn.valueFormats.hertz = kbn.formatBuilders.decimalSIPrefix('Hz');

kbn.valueFormats.ms = (size, decimals, scaledDecimals) => {
  if (size === null) {
    return '';
  }

  if (Math.abs(size) < 1000) {
    return kbn.toFixed(size, decimals) + ' ms';
  } else if (Math.abs(size) < 60000) {
    // Less than 1 min
    return kbn.toFixedScaled(size / 1000, decimals, scaledDecimals, 3, ' s');
  } else if (Math.abs(size) < 3600000) {
    // Less than 1 hour, divide in minutes
    return kbn.toFixedScaled(size / 60000, decimals, scaledDecimals, 5, ' min');
  } else if (Math.abs(size) < 86400000) {
    // Less than one day, divide in hours
    return kbn.toFixedScaled(size / 3600000, decimals, scaledDecimals, 7, ' hour');
  } else if (Math.abs(size) < 31536000000) {
    // Less than one year, divide in days
    return kbn.toFixedScaled(size / 86400000, decimals, scaledDecimals, 8, ' day');
  }

  return kbn.toFixedScaled(size / 31536000000, decimals, scaledDecimals, 10, ' year');
};

kbn.valueFormats.s = (size, decimals, scaledDecimals) => {
  if (size === null) {
    return '';
  }

  // Less than 1 µs, divide in ns
  if (Math.abs(size) < 0.000001) {
    return kbn.toFixedScaled(size * 1e9, decimals, scaledDecimals - decimals, -9, ' ns');
  }
  // Less than 1 ms, divide in µs
  if (Math.abs(size) < 0.001) {
    return kbn.toFixedScaled(size * 1e6, decimals, scaledDecimals - decimals, -6, ' µs');
  }
  // Less than 1 second, divide in ms
  if (Math.abs(size) < 1) {
    return kbn.toFixedScaled(size * 1e3, decimals, scaledDecimals - decimals, -3, ' ms');
  }

  if (Math.abs(size) < 60) {
    return kbn.toFixed(size, decimals) + ' s';
  } else if (Math.abs(size) < 3600) {
    // Less than 1 hour, divide in minutes
    return kbn.toFixedScaled(size / 60, decimals, scaledDecimals, 1, ' min');
  } else if (Math.abs(size) < 86400) {
    // Less than one day, divide in hours
    return kbn.toFixedScaled(size / 3600, decimals, scaledDecimals, 4, ' hour');
  } else if (Math.abs(size) < 604800) {
    // Less than one week, divide in days
    return kbn.toFixedScaled(size / 86400, decimals, scaledDecimals, 5, ' day');
  } else if (Math.abs(size) < 31536000) {
    // Less than one year, divide in week
    return kbn.toFixedScaled(size / 604800, decimals, scaledDecimals, 6, ' week');
  }

  return kbn.toFixedScaled(size / 3.15569e7, decimals, scaledDecimals, 7, ' year');
};

kbn.valueFormats['µs'] = (size, decimals, scaledDecimals) => {
  if (size === null) {
    return '';
  }

  if (Math.abs(size) < 1000) {
    return kbn.toFixed(size, decimals) + ' µs';
  } else if (Math.abs(size) < 1000000) {
    return kbn.toFixedScaled(size / 1000, decimals, scaledDecimals, 3, ' ms');
  } else {
    return kbn.toFixedScaled(size / 1000000, decimals, scaledDecimals, 6, ' s');
  }
};

kbn.valueFormats.ns = (size, decimals, scaledDecimals) => {
  if (size === null) {
    return '';
  }

  if (Math.abs(size) < 1000) {
    return kbn.toFixed(size, decimals) + ' ns';
  } else if (Math.abs(size) < 1000000) {
    return kbn.toFixedScaled(size / 1000, decimals, scaledDecimals, 3, ' µs');
  } else if (Math.abs(size) < 1000000000) {
    return kbn.toFixedScaled(size / 1000000, decimals, scaledDecimals, 6, ' ms');
  } else if (Math.abs(size) < 60000000000) {
    return kbn.toFixedScaled(size / 1000000000, decimals, scaledDecimals, 9, ' s');
  } else {
    return kbn.toFixedScaled(size / 60000000000, decimals, scaledDecimals, 12, ' min');
  }
};

kbn.valueFormats.m = (size, decimals, scaledDecimals) => {
  if (size === null) {
    return '';
  }

  if (Math.abs(size) < 60) {
    return kbn.toFixed(size, decimals) + ' min';
  } else if (Math.abs(size) < 1440) {
    return kbn.toFixedScaled(size / 60, decimals, scaledDecimals, 2, ' hour');
  } else if (Math.abs(size) < 10080) {
    return kbn.toFixedScaled(size / 1440, decimals, scaledDecimals, 3, ' day');
  } else if (Math.abs(size) < 604800) {
    return kbn.toFixedScaled(size / 10080, decimals, scaledDecimals, 4, ' week');
  } else {
    return kbn.toFixedScaled(size / 5.25948e5, decimals, scaledDecimals, 5, ' year');
  }
};

kbn.valueFormats.h = (size, decimals, scaledDecimals) => {
  if (size === null) {
    return '';
  }

  if (Math.abs(size) < 24) {
    return kbn.toFixed(size, decimals) + ' hour';
  } else if (Math.abs(size) < 168) {
    return kbn.toFixedScaled(size / 24, decimals, scaledDecimals, 2, ' day');
  } else if (Math.abs(size) < 8760) {
    return kbn.toFixedScaled(size / 168, decimals, scaledDecimals, 3, ' week');
  } else {
    return kbn.toFixedScaled(size / 8760, decimals, scaledDecimals, 4, ' year');
  }
};

kbn.valueFormats.d = (size, decimals, scaledDecimals) => {
  if (size === null) {
    return '';
  }

  if (Math.abs(size) < 7) {
    return kbn.toFixed(size, decimals) + ' day';
  } else if (Math.abs(size) < 365) {
    return kbn.toFixedScaled(size / 7, decimals, scaledDecimals, 2, ' week');
  } else {
    return kbn.toFixedScaled(size / 365, decimals, scaledDecimals, 3, ' year');
  }
};

kbn.toDuration = (size, decimals, timeScale) => {
  if (size === null) {
    return '';
  }
  if (size === 0) {
    return '0 ' + timeScale + 's';
  }
  if (size < 0) {
    return kbn.toDuration(-size, decimals, timeScale) + ' ago';
  }

  const units = [
    { short: 'y', long: 'year' },
    { short: 'M', long: 'month' },
    { short: 'w', long: 'week' },
    { short: 'd', long: 'day' },
    { short: 'h', long: 'hour' },
    { short: 'm', long: 'minute' },
    { short: 's', long: 'second' },
    { short: 'ms', long: 'millisecond' },
  ];
  // convert $size to milliseconds
  // intervals_in_seconds uses seconds (duh), convert them to milliseconds here to minimize floating point errors
  size *=
    kbn.intervals_in_seconds[
      units.find(e => {
        return e.long === timeScale;
      }).short
    ] * 1000;

  const strings = [];
  // after first value >= 1 print only $decimals more
  let decrementDecimals = false;
  for (let i = 0; i < units.length && decimals >= 0; i++) {
    const interval = kbn.intervals_in_seconds[units[i].short] * 1000;
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
};

kbn.toClock = (size, decimals) => {
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
};

kbn.valueFormats.dtdurationms = (size, decimals) => {
  return kbn.toDuration(size, decimals, 'millisecond');
};

kbn.valueFormats.dtdurations = (size, decimals) => {
  return kbn.toDuration(size, decimals, 'second');
};

kbn.valueFormats.dthms = (size, decimals) => {
  return kbn.secondsToHhmmss(size);
};

kbn.valueFormats.timeticks = (size, decimals, scaledDecimals) => {
  return kbn.valueFormats.s(size / 100, decimals, scaledDecimals);
};

kbn.valueFormats.clockms = (size, decimals) => {
  return kbn.toClock(size, decimals);
};

kbn.valueFormats.clocks = (size, decimals) => {
  return kbn.toClock(size * 1000, decimals);
};

kbn.valueFormats.dateTimeAsIso = (epoch, isUtc) => {
  const time = isUtc ? moment.utc(epoch) : moment(epoch);

  if (moment().isSame(epoch, 'day')) {
    return time.format('HH:mm:ss');
  }
  return time.format('YYYY-MM-DD HH:mm:ss');
};

kbn.valueFormats.dateTimeAsUS = (epoch, isUtc) => {
  const time = isUtc ? moment.utc(epoch) : moment(epoch);

  if (moment().isSame(epoch, 'day')) {
    return time.format('h:mm:ss a');
  }
  return time.format('MM/DD/YYYY h:mm:ss a');
};

kbn.valueFormats.dateTimeFromNow = (epoch, isUtc) => {
  const time = isUtc ? moment.utc(epoch) : moment(epoch);
  return time.fromNow();
};

///// FORMAT MENU /////

kbn.getUnitFormats = () => {
  return [
    {
      label: 'none',
      options: [
        { label: 'none', value: 'none' },
        { label: 'short', value: 'short' },
        { label: 'percent (0-100)', value: 'percent' },
        { label: 'percent (0.0-1.0)', value: 'percentunit' },
        { label: 'Humidity (%H)', value: 'humidity' },
        { label: 'decibel', value: 'dB' },
        { label: 'hexadecimal (0x)', value: 'hex0x' },
        { label: 'hexadecimal', value: 'hex' },
        { label: 'scientific notation', value: 'sci' },
        { label: 'locale format', value: 'locale' },
      ],
    },
    {
      label: 'currency',
      options: [
        { label: 'Dollars ($)', value: 'currencyUSD' },
        { label: 'Pounds (£)', value: 'currencyGBP' },
        { label: 'Euro (€)', value: 'currencyEUR' },
        { label: 'Yen (¥)', value: 'currencyJPY' },
        { label: 'Rubles (₽)', value: 'currencyRUB' },
        { label: 'Hryvnias (₴)', value: 'currencyUAH' },
        { label: 'Real (R$)', value: 'currencyBRL' },
        { label: 'Danish Krone (kr)', value: 'currencyDKK' },
        { label: 'Icelandic Króna (kr)', value: 'currencyISK' },
        { label: 'Norwegian Krone (kr)', value: 'currencyNOK' },
        { label: 'Swedish Krona (kr)', value: 'currencySEK' },
        { label: 'Czech koruna (czk)', value: 'currencyCZK' },
        { label: 'Swiss franc (CHF)', value: 'currencyCHF' },
        { label: 'Polish Złoty (PLN)', value: 'currencyPLN' },
        { label: 'Bitcoin (฿)', value: 'currencyBTC' },
      ],
    },
    {
      label: 'time',
      options: [
        { label: 'Hertz (1/s)', value: 'hertz' },
        { label: 'nanoseconds (ns)', value: 'ns' },
        { label: 'microseconds (µs)', value: 'µs' },
        { label: 'milliseconds (ms)', value: 'ms' },
        { label: 'seconds (s)', value: 's' },
        { label: 'minutes (m)', value: 'm' },
        { label: 'hours (h)', value: 'h' },
        { label: 'days (d)', value: 'd' },
        { label: 'duration (ms)', value: 'dtdurationms' },
        { label: 'duration (s)', value: 'dtdurations' },
        { label: 'duration (hh:mm:ss)', value: 'dthms' },
        { label: 'Timeticks (s/100)', value: 'timeticks' },
        { label: 'clock (ms)', value: 'clockms' },
        { label: 'clock (s)', value: 'clocks' },
      ],
    },
    {
      label: 'date & time',
      options: [
        { label: 'YYYY-MM-DD HH:mm:ss', value: 'dateTimeAsIso' },
        { label: 'DD/MM/YYYY h:mm:ss a', value: 'dateTimeAsUS' },
        { label: 'From Now', value: 'dateTimeFromNow' },
      ],
    },
    {
      label: 'data (IEC)',
      options: [
        { label: 'bits', value: 'bits' },
        { label: 'bytes', value: 'bytes' },
        { label: 'kibibytes', value: 'kbytes' },
        { label: 'mebibytes', value: 'mbytes' },
        { label: 'gibibytes', value: 'gbytes' },
      ],
    },
    {
      label: 'data (Metric)',
      options: [
        { label: 'bits', value: 'decbits' },
        { label: 'bytes', value: 'decbytes' },
        { label: 'kilobytes', value: 'deckbytes' },
        { label: 'megabytes', value: 'decmbytes' },
        { label: 'gigabytes', value: 'decgbytes' },
      ],
    },
    {
      label: 'data rate',
      options: [
        { label: 'packets/sec', value: 'pps' },
        { label: 'bits/sec', value: 'bps' },
        { label: 'bytes/sec', value: 'Bps' },
        { label: 'kilobits/sec', value: 'Kbits' },
        { label: 'kilobytes/sec', value: 'KBs' },
        { label: 'megabits/sec', value: 'Mbits' },
        { label: 'megabytes/sec', value: 'MBs' },
        { label: 'gigabytes/sec', value: 'GBs' },
        { label: 'gigabits/sec', value: 'Gbits' },
      ],
    },
    {
      label: 'hash rate',
      options: [
        { label: 'hashes/sec', value: 'Hs' },
        { label: 'kilohashes/sec', value: 'KHs' },
        { label: 'megahashes/sec', value: 'MHs' },
        { label: 'gigahashes/sec', value: 'GHs' },
        { label: 'terahashes/sec', value: 'THs' },
        { label: 'petahashes/sec', value: 'PHs' },
        { label: 'exahashes/sec', value: 'EHs' },
      ],
    },
    {
      label: 'throughput',
      options: [
        { label: 'ops/sec (ops)', value: 'ops' },
        { label: 'requests/sec (rps)', value: 'reqps' },
        { label: 'reads/sec (rps)', value: 'rps' },
        { label: 'writes/sec (wps)', value: 'wps' },
        { label: 'I/O ops/sec (iops)', value: 'iops' },
        { label: 'ops/min (opm)', value: 'opm' },
        { label: 'reads/min (rpm)', value: 'rpm' },
        { label: 'writes/min (wpm)', value: 'wpm' },
      ],
    },
    {
      label: 'length',
      options: [
        { label: 'millimetre (mm)', value: 'lengthmm' },
        { label: 'meter (m)', value: 'lengthm' },
        { label: 'feet (ft)', value: 'lengthft' },
        { label: 'kilometer (km)', value: 'lengthkm' },
        { label: 'mile (mi)', value: 'lengthmi' },
      ],
    },
    {
      label: 'area',
      options: [
        { label: 'Square Meters (m²)', value: 'areaM2' },
        { label: 'Square Feet (ft²)', value: 'areaF2' },
        { label: 'Square Miles (mi²)', value: 'areaMI2' },
      ],
    },
    {
      label: 'mass',
      options: [
        { label: 'milligram (mg)', value: 'massmg' },
        { label: 'gram (g)', value: 'massg' },
        { label: 'kilogram (kg)', value: 'masskg' },
        { label: 'metric ton (t)', value: 'masst' },
      ],
    },
    {
      label: 'velocity',
      options: [
        { label: 'metres/second (m/s)', value: 'velocityms' },
        { label: 'kilometers/hour (km/h)', value: 'velocitykmh' },
        { label: 'miles/hour (mph)', value: 'velocitymph' },
        { label: 'knot (kn)', value: 'velocityknot' },
      ],
    },
    {
      label: 'volume',
      options: [
        { label: 'millilitre (mL)', value: 'mlitre' },
        { label: 'litre (L)', value: 'litre' },
        { label: 'cubic metre', value: 'm3' },
        { label: 'Normal cubic metre', value: 'Nm3' },
        { label: 'cubic decimetre', value: 'dm3' },
        { label: 'gallons', value: 'gallons' },
      ],
    },
    {
      label: 'energy',
      options: [
        { label: 'Watt (W)', value: 'watt' },
        { label: 'Kilowatt (kW)', value: 'kwatt' },
        { label: 'Milliwatt (mW)', value: 'mwatt' },
        { label: 'Watt per square metre (W/m²)', value: 'Wm2' },
        { label: 'Volt-ampere (VA)', value: 'voltamp' },
        { label: 'Kilovolt-ampere (kVA)', value: 'kvoltamp' },
        { label: 'Volt-ampere reactive (var)', value: 'voltampreact' },
        { label: 'Kilovolt-ampere reactive (kvar)', value: 'kvoltampreact' },
        { label: 'Watt-hour (Wh)', value: 'watth' },
        { label: 'Kilowatt-hour (kWh)', value: 'kwatth' },
        { label: 'Kilowatt-min (kWm)', value: 'kwattm' },
        { label: 'Joule (J)', value: 'joule' },
        { label: 'Electron volt (eV)', value: 'ev' },
        { label: 'Ampere (A)', value: 'amp' },
        { label: 'Kiloampere (kA)', value: 'kamp' },
        { label: 'Milliampere (mA)', value: 'mamp' },
        { label: 'Volt (V)', value: 'volt' },
        { label: 'Kilovolt (kV)', value: 'kvolt' },
        { label: 'Millivolt (mV)', value: 'mvolt' },
        { label: 'Decibel-milliwatt (dBm)', value: 'dBm' },
        { label: 'Ohm (Ω)', value: 'ohm' },
        { label: 'Lumens (Lm)', value: 'lumens' },
      ],
    },
    {
      label: 'temperature',
      options: [
        { label: 'Celsius (°C)', value: 'celsius' },
        { label: 'Farenheit (°F)', value: 'farenheit' },
        { label: 'Kelvin (K)', value: 'kelvin' },
      ],
    },
    {
      label: 'pressure',
      options: [
        { label: 'Millibars', value: 'pressurembar' },
        { label: 'Bars', value: 'pressurebar' },
        { label: 'Kilobars', value: 'pressurekbar' },
        { label: 'Hectopascals', value: 'pressurehpa' },
        { label: 'Kilopascals', value: 'pressurekpa' },
        { label: 'Inches of mercury', value: 'pressurehg' },
        { label: 'PSI', value: 'pressurepsi' },
      ],
    },
    {
      label: 'force',
      options: [
        { label: 'Newton-meters (Nm)', value: 'forceNm' },
        { label: 'Kilonewton-meters (kNm)', value: 'forcekNm' },
        { label: 'Newtons (N)', value: 'forceN' },
        { label: 'Kilonewtons (kN)', value: 'forcekN' },
      ],
    },
    {
      label: 'flow',
      options: [
        { label: 'Gallons/min (gpm)', value: 'flowgpm' },
        { label: 'Cubic meters/sec (cms)', value: 'flowcms' },
        { label: 'Cubic feet/sec (cfs)', value: 'flowcfs' },
        { label: 'Cubic feet/min (cfm)', value: 'flowcfm' },
        { label: 'Litre/hour', value: 'litreh' },
        { label: 'Litre/min (l/min)', value: 'flowlpm' },
        { label: 'milliLitre/min (mL/min)', value: 'flowmlpm' },
      ],
    },
    {
      label: 'angle',
      options: [
        { label: 'Degrees (°)', value: 'degree' },
        { label: 'Radians', value: 'radian' },
        { label: 'Gradian', value: 'grad' },
      ],
    },
    {
      label: 'acceleration',
      options: [
        { label: 'Meters/sec²', value: 'accMS2' },
        { label: 'Feet/sec²', value: 'accFS2' },
        { label: 'G unit', value: 'accG' },
      ],
    },
    {
      label: 'radiation',
      options: [
        { label: 'Becquerel (Bq)', value: 'radbq' },
        { label: 'curie (Ci)', value: 'radci' },
        { label: 'Gray (Gy)', value: 'radgy' },
        { label: 'rad', value: 'radrad' },
        { label: 'Sievert (Sv)', value: 'radsv' },
        { label: 'rem', value: 'radrem' },
        { label: 'Exposure (C/kg)', value: 'radexpckg' },
        { label: 'roentgen (R)', value: 'radr' },
        { label: 'Sievert/hour (Sv/h)', value: 'radsvh' },
      ],
    },
    {
      label: 'concentration',
      options: [
        { label: 'parts-per-million (ppm)', value: 'ppm' },
        { label: 'parts-per-billion (ppb)', value: 'conppb' },
        { label: 'nanogram per cubic metre (ng/m³)', value: 'conngm3' },
        { label: 'nanogram per normal cubic metre (ng/Nm³)', value: 'conngNm3' },
        { label: 'microgram per cubic metre (μg/m³)', value: 'conμgm3' },
        { label: 'microgram per normal cubic metre (μg/Nm³)', value: 'conμgNm3' },
        { label: 'milligram per cubic metre (mg/m³)', value: 'conmgm3' },
        { label: 'milligram per normal cubic metre (mg/Nm³)', value: 'conmgNm3' },
        { label: 'gram per cubic metre (g/m³)', value: 'congm3' },
        { label: 'gram per normal cubic metre (g/Nm³)', value: 'congNm3' },
      ],
    },
  ];
};

export default kbn;
