import { getCategories } from './categories';
import { DecimalCount } from '../../types';

export type ValueFormatter = (
  value: number,
  decimals?: DecimalCount,
  scaledDecimals?: DecimalCount,
  isUtc?: boolean
) => string;

export interface ValueFormat {
  name: string;
  id: string;
  fn: ValueFormatter;
}

export interface ValueFormatCategory {
  name: string;
  formats: ValueFormat[];
}

interface ValueFormatterIndex {
  [id: string]: ValueFormatter;
}

// Globals & formats cache
let categories: ValueFormatCategory[] = [];
const index: ValueFormatterIndex = {};
let hasBuiltIndex = false;

export function toFixed(value: number, decimals?: DecimalCount): string {
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

export function toFixedScaled(
  value: number,
  decimals: DecimalCount,
  scaledDecimals: DecimalCount,
  additionalDecimals: number,
  ext?: string
) {
  if (scaledDecimals === null || scaledDecimals === undefined) {
    return toFixed(value, decimals) + ext;
  } else {
    return toFixed(value, scaledDecimals + additionalDecimals) + ext;
  }

  return toFixed(value, decimals) + ext;
}

export function toFixedUnit(unit: string): ValueFormatter {
  return (size: number, decimals?: DecimalCount) => {
    if (size === null) {
      return '';
    }
    return toFixed(size, decimals) + ' ' + unit;
  };
}

// Formatter which scales the unit string geometrically according to the given
// numeric factor. Repeatedly scales the value down by the factor until it is
// less than the factor in magnitude, or the end of the array is reached.
export function scaledUnits(factor: number, extArray: string[]) {
  return (size: number, decimals?: DecimalCount, scaledDecimals?: DecimalCount) => {
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

    if (steps > 0 && scaledDecimals !== null && scaledDecimals !== undefined) {
      decimals = scaledDecimals + 3 * steps;
    }

    return toFixed(size, decimals) + extArray[steps];
  };
}

export function locale(value: number, decimals: DecimalCount) {
  if (value == null) {
    return '';
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: decimals as number });
}

export function simpleCountUnit(symbol: string) {
  const units = ['', 'K', 'M', 'B', 'T'];
  const scaler = scaledUnits(1000, units);
  return (size: number, decimals?: DecimalCount, scaledDecimals?: DecimalCount) => {
    if (size === null) {
      return '';
    }
    const scaled = scaler(size, decimals, scaledDecimals);
    return scaled + ' ' + symbol;
  };
}

function buildFormats() {
  categories = getCategories();

  for (const cat of categories) {
    for (const format of cat.formats) {
      index[format.id] = format.fn;
    }
  }

  hasBuiltIndex = true;
}

export function getValueFormat(id: string): ValueFormatter {
  if (!hasBuiltIndex) {
    buildFormats();
  }

  return index[id];
}

export function getValueFormatterIndex(): ValueFormatterIndex {
  if (!hasBuiltIndex) {
    buildFormats();
  }

  return index;
}

export function getValueFormats() {
  if (!hasBuiltIndex) {
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
