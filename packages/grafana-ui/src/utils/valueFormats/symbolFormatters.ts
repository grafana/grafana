import { scaledUnits } from './valueFormats';
import { DecimalCount } from '../../types';

export function currency(symbol: string) {
  const units = ['', 'K', 'M', 'B', 'T'];
  const scaler = scaledUnits(1000, units);
  return (size: number, decimals?: DecimalCount, scaledDecimals?: DecimalCount) => {
    if (size === null) {
      return '';
    }
    const scaled = scaler(size, decimals, scaledDecimals);
    return symbol + scaled;
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
  let prefixes = ['n', 'µ', 'm', '', 'k', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y'];
  prefixes = prefixes.slice(3 + (offset || 0));
  const units = prefixes.map(p => {
    return ' ' + p + unit;
  });
  return scaledUnits(1000, units);
}
