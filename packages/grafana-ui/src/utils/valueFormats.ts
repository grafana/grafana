type ValueFormatter = (value: number, decimals?: number, scaledDecimals?: number) => string;

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

function buildFormats() {
  categories = [
    {
      name: 'none',
      formats: [
        {
          name: 'none',
          id: 'none',
          fn: toFixed,
        },
        {
          name: 'short',
          id: 'short',
          fn: scaledUnits(1000, ['', ' K', ' Mil', ' Bil', ' Tri', ' Quadr', ' Quint', ' Sext', ' Sept']),
        },
        {
          name: 'percent (0-100)',
          id: 'percent',
          fn: toPercent,
        },
        {
          name: 'percent (0.0-1.0)',
          id: 'percentunit',
          fn: toPercentUnit,
        },
        {
          name: 'Humidity (%H)',
          id: 'humidity',
          fn: toFixedUnit('%H'),
        },
        {
          name: 'decibel',
          id: 'dB',
          fn: toFixedUnit('dB'),
        },
        {
          name: 'hexadecimal (0x)',
          id: 'hex0x',
          fn: toHex0x,
        },
        {
          name: 'hexadecimal',
          id: 'hex',
          fn: hex,
        },
        {
          name: 'scientific notation',
          id: 'sci',
          fn: sci,
        },
        {
          name: 'locale format',
          id: 'locale',
          fn: locale,
        },
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
          value: format.id,
        };
      }),
    };
  });
}
