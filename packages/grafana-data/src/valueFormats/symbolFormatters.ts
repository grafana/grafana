import { DecimalCount } from '../types/displayValue';

import { scaledUnits, ValueFormatter } from './valueFormats';

export function currency(symbol: string, asSuffix?: boolean): ValueFormatter {
  const units = ['', 'K', 'M', 'B', 'T'];
  const scaler = scaledUnits(1000, units);
  return (value: number, decimals?: DecimalCount, scaledDecimals?: DecimalCount) => {
    if (value == null) {
      return { text: '' };
    }
    const isNegative = value < 0;
    if (isNegative) {
      value = Math.abs(value);
    }
    const scaled = scaler(value, decimals, scaledDecimals);
    if (asSuffix) {
      scaled.suffix = scaled.suffix !== undefined ? `${scaled.suffix}${symbol}` : undefined;
    } else {
      scaled.prefix = symbol;
    }
    if (isNegative) {
      scaled.prefix = `-${scaled.prefix?.length ? scaled.prefix : ''}`;
    }
    return scaled;
  };
}

const SI_PREFIXES = ['f', 'p', 'n', 'µ', 'm', '', 'k', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y'];
const SI_BASE_INDEX = SI_PREFIXES.indexOf('');

export function getOffsetFromSIPrefix(c: string): number {
  const charIndex = SI_PREFIXES.findIndex((prefix) => prefix.normalize('NFKD') === c.normalize('NFKD'));
  return charIndex < 0 ? 0 : charIndex - SI_BASE_INDEX;
}

const BIN_PREFIXES = ['', 'Ki', 'Mi', 'Gi', 'Ti', 'Pi', 'Ei', 'Zi', 'Yi'];

export function binaryPrefix(unit: string, offset = 0): ValueFormatter {
  const units = BIN_PREFIXES.map((p) => ' ' + p + unit);
  return scaledUnits(1024, units, offset);
}

export function SIPrefix(unit: string, offset = 0): ValueFormatter {
  const units = SI_PREFIXES.map((p) => ' ' + p + unit);
  return scaledUnits(1000, units, SI_BASE_INDEX + offset);
}
