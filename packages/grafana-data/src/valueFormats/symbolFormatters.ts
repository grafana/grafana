import { scaledUnits, ValueFormatter } from './valueFormats';
import { DecimalCount } from '../types/displayValue';

export function currency(symbol: string, asSuffix?: boolean): ValueFormatter {
  const units = ['', 'K', 'M', 'B', 'T'];
  const scaler = scaledUnits(1000, units);
  return (size: number, decimals?: DecimalCount, scaledDecimals?: DecimalCount) => {
    if (size === null) {
      return { text: '' };
    }
    const scaled = scaler(size, decimals, scaledDecimals);
    if (asSuffix) {
      scaled.suffix = scaled.suffix !== undefined ? `${scaled.suffix}${symbol}` : undefined;
    } else {
      scaled.prefix = symbol;
    }
    return scaled;
  };
}

export function getOffsetFromSIPrefix(c: string): number {
  switch (c) {
    case 'f':
      return -5;
    case 'p':
      return -4;
    case 'n':
      return -3;
    case 'μ': // Two different unicode chars for µ
    case 'µ':
      return -2;
    case 'm':
      return -1;
    case '':
      return 0;
    case 'k':
      return 1;
    case 'M':
      return 2;
    case 'G':
      return 3;
    case 'T':
      return 4;
    case 'P':
      return 5;
    case 'E':
      return 6;
    case 'Z':
      return 7;
    case 'Y':
      return 8;
  }
  return 0;
}

export function binaryPrefix(unit: string, offset = 0): ValueFormatter {
  const prefixes = ['', 'Ki', 'Mi', 'Gi', 'Ti', 'Pi', 'Ei', 'Zi', 'Yi'].slice(offset);
  const units = prefixes.map(p => {
    return ' ' + p + unit;
  });
  return scaledUnits(1024, units);
}

export function SIPrefix(unit: string, offset = 0): ValueFormatter {
  let prefixes = ['f', 'p', 'n', 'µ', 'm', '', 'k', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y'];
  prefixes = prefixes.slice(5 + (offset || 0));
  const units = prefixes.map(p => {
    return ' ' + p + unit;
  });
  return scaledUnits(1000, units);
}
