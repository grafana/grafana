import { DecimalCount } from '../types/displayValue';

import { scaledUnits, ValueFormatter, FormattedValue, toFixed } from './valueFormats';

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

export function addBIPrefix(prefixKey: string): ValueFormatter {
  return (value: number, decimals: DecimalCount): FormattedValue => {
    const symbolMap: { [key: string]: string } = {
      lessThan: '<',
      greaterThan: '>',
      approximately: '~',
      positive: '+',
      fiscalQuarter: 'FQ',
      quarter: 'Qtr',
      fiscalYear: 'FY',
      delta: '\u0394',
      mean: '\u00B5',
    };

    const newPrefix: string = symbolMap[prefixKey];

    // Invalid prefix? Return original text in a text object.
    if (!newPrefix) {
      return { text: toFixed(value, decimals) };
    }

    return { prefix: newPrefix, text: toFixed(value, decimals) };
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
