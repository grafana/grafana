import { type DecimalCount } from '../types/displayValue';
import { type ValueFormatter } from '../types/valueFormats';

import { scaledUnits } from './baseFormatters';

export function currency(symbol: string, asSuffix?: boolean): ValueFormatter {
  const units = ['', ' тыс.', ' млн.', ' млрд.', ' трлн.'];
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
    if (symbol === '₽') {
      scaled.text = Number(scaled.text).toLocaleString(undefined, { maximumFractionDigits: decimals ?? undefined })
      scaled.prefix = '';
      scaled.suffix += ' ₽';
    }
    // console.log(scaled.text)
    return scaled;
  };
}

/**
 * Formats currency values without scaling abbreviations(K: Thousands, M: Millions, B: Billions), displaying full numeric values.
 * Uses cached Intl.NumberFormat objects for performance.
 *
 * @param symbol - Currency symbol (e.g., '$', '€', '£')
 * @param asSuffix - If true, places symbol after number
 *
 * @example
 * fullCurrency('$')(1234.56, 2) // { prefix: '$', text: '1,234.56' } - forces 2 decimals
 * fullCurrency('€', true)(42.5) // { suffix: '€', text: '42.5' }
 */
export function fullCurrency(symbol: string, asSuffix?: boolean): ValueFormatter {
  const locale = Intl.NumberFormat().resolvedOptions().locale;
  const defaultFormatter = new Intl.NumberFormat(locale, { minimumFractionDigits: 0, maximumFractionDigits: 1 });
  const formattersCache = new Map<number, Intl.NumberFormat>();

  return (value: number | null, decimals?: DecimalCount) => {
    if (value === null) {
      return { text: '' };
    }

    const numericValue: number = value;

    let text: string;
    if (decimals !== undefined && decimals !== null) {
      let formatter = formattersCache.get(decimals);
      if (!formatter) {
        formatter = new Intl.NumberFormat(locale, {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        });
        formattersCache.set(decimals, formatter);
      }
      text = formatter.format(numericValue);
    } else {
      text = defaultFormatter.format(numericValue);
    }

    return {
      prefix: asSuffix ? '' : symbol,
      suffix: asSuffix ? symbol : '',
      text,
    };
  };
}

const SI_PREFIXES = ['f', 'p', 'n', 'µ', 'm', '', 'k', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y'];
const SI_BASE_INDEX = SI_PREFIXES.indexOf('');
const SI_BASE_INDEX_SHORT = SI_PREFIXES_SHORT.indexOf('');

export function getOffsetFromSIPrefix(c: string): number {
  const charIndex = SI_PREFIXES.findIndex((prefix) => prefix.normalize('NFKD') === c.normalize('NFKD'));
  return charIndex < 0 ? 0 : charIndex - SI_BASE_INDEX;
}

const BIN_PREFIXES = ['', 'Ки', 'Ми', 'Ги', 'Ти', 'Пи', 'Эи"', 'Зи', 'Йи'];

export function binaryPrefix(unit: string, offset = 0): ValueFormatter {
  const units = BIN_PREFIXES.map((p) => ' ' + p + unit);
  return scaledUnits(1024, units, offset);
}

export function SIPrefix(unit: string, offset = 0, short = false): ValueFormatter {
  const units = short ? SI_PREFIXES_SHORT.map((p) => ' ' + p + unit) : SI_PREFIXES.map((p) => ' ' + p + unit);
  const scaler = scaledUnits(1000, units, short ? SI_BASE_INDEX_SHORT + offset : SI_BASE_INDEX + offset);
  return (value: number, decimals?: DecimalCount, scaledDecimals?: DecimalCount) => {
    if (value == null) {
      return { text: '' };
    }
    const isNegative = value < 0;
    if (isNegative) {
      value = Math.abs(value);
    }
    const scaled = scaler(value, decimals, scaledDecimals);
    scaled.text = Number(scaled.text).toLocaleString(undefined, { maximumFractionDigits: decimals ?? undefined })
    
    // console.log(scaled.text)
    return scaled;
  };
}
