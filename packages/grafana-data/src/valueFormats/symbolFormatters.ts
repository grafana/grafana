import { DecimalCount } from '../types/displayValue';

import { scaledUnits, ValueFormatter } from './valueFormats';

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

export function fullCurrency(symbol: string, asSuffix?: boolean): ValueFormatter {
  return (size: number, decimals?: DecimalCount) => {
    if (size === null) {
      return { text: '' };
    }

    const locale = Intl.NumberFormat().resolvedOptions().locale;
    const number = Intl.NumberFormat(locale, { minimumFractionDigits: 0, maximumFractionDigits: 1 }).format(size);

    const text = decimals
      ? Intl.NumberFormat(locale, {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }).format(size)
      : number;

    return {
      prefix: asSuffix ? '' : symbol,
      suffix: asSuffix ? symbol : '',
      text,
    };
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
