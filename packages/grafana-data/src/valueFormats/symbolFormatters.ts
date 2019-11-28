import { scaledUnits, ValueFormatter } from './valueFormats';
import { DecimalCount } from '../types/displayValue';

export function currency(symbol: string, asSuffix?: boolean): ValueFormatter {
  const units = ['', 'K', 'M', 'B', 'T'];
  const scaler = scaledUnits(1000, units);
  return (size: number, decimals?: DecimalCount, scaledDecimals?: DecimalCount) => {
    if (size === null) {
      return { prefix: '', value: '', suffix: '' };
    }
    const scaled = scaler(size, decimals, scaledDecimals);
    if (asSuffix) {
      scaled.suffix = symbol;
    } else {
      scaled.prefix = symbol;
    }
    return scaled;
  };
}

export function binarySIPrefix(unit: string, offset = 0) {
  const prefixes = ['', 'Ki', 'Mi', 'Gi', 'Ti', 'Pi', 'Ei', 'Zi', 'Yi'].slice(offset);
  const units = prefixes.map(p => {
    return ' ' + p + unit;
  });
  return scaledUnits(1024, units);
}

export function decimalSIPrefix(unit: string, offset = 0) {
  let prefixes = ['f', 'p', 'n', 'µ', 'm', '', 'k', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y'];
  prefixes = prefixes.slice(5 + (offset || 0));
  const units = prefixes.map(p => {
    return ' ' + p + unit;
  });
  return scaledUnits(1000, units);
}
