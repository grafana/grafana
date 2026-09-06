import { type DecimalCount } from '../types/displayValue';
import { type ValueFormatter } from '../types/valueFormats';

import { resolveUnit, scaledUnits, type UnitLike } from './baseFormatters';
import { getBinaryPrefixSymbols, getSIPrefixSymbols } from './unitSymbols';

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

// This table stays ASCII/international on purpose. It serves two roles:
//  1) parsing raw unit ids users type themselves (e.g. a field override
//     typed as `si:mV`) — those ids are configuration values, not display
//     text, and must not vary by locale;
//  2) the *default, unchanged* display behavior for every SIPrefix()/
//     binaryPrefix() call site that hasn't been deliberately migrated to a
//     translated base unit (see the `localized` flag below) — e.g. FLOPS,
//     which stays "MFLOPS" in every locale rather than becoming "МFLOPS".
const SI_PREFIXES = ['f', 'p', 'n', 'µ', 'm', '', 'k', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y'];
const SI_BASE_INDEX = SI_PREFIXES.indexOf('');
const BIN_PREFIXES = ['', 'Ki', 'Mi', 'Gi', 'Ti', 'Pi', 'Ei', 'Zi', 'Yi'];

export function getOffsetFromSIPrefix(c: string): number {
  const charIndex = SI_PREFIXES.findIndex((prefix) => prefix.normalize('NFKD') === c.normalize('NFKD'));
  return charIndex < 0 ? 0 : charIndex - SI_BASE_INDEX;
}

/**
 * `unit` may be a plain string (unchanged legacy behavior: ASCII prefixes,
 * exactly as before this patch) or — for the built-in categories in
 * `categories.ts` that have been deliberately reviewed and translated — a
 * thunk. Passing a thunk is also what switches this call to *translated*
 * magnitude prefixes (`getBinaryPrefixSymbols()`) instead of the ASCII
 * `BIN_PREFIXES` table above. This keeps every call site we haven't touched
 * (there is currently no untouched `binaryPrefix` call, but the guard is
 * here for consistency with `SIPrefix` and for future additions) behaving
 * exactly as it does today, with zero risk of an unintended side effect.
 */
export function binaryPrefix(unit: UnitLike, offset = 0): ValueFormatter {
  const localized = typeof unit === 'function';
  return (size: number, decimals?: DecimalCount, scaledDecimals?: DecimalCount) => {
    const base = resolveUnit(unit);
    const prefixes = localized ? getBinaryPrefixSymbols() : BIN_PREFIXES;
    const units = prefixes.map((p) => ' ' + p + base);
    return scaledUnits(1024, units, offset)(size, decimals, scaledDecimals);
  };
}

/**
 * Same idea as `binaryPrefix` above: a thunk both supplies the translated
 * base unit AND opts this specific call into translated SI prefixes
 * (`getSIPrefixSymbols()`). Plain-string calls — including ones we
 * deliberately chose not to translate, like `SIPrefix('FLOPS', n)` or
 * `SIPrefix('H/s', n)` (see unitSymbols.review.md) — keep today's ASCII
 * `SI_PREFIXES` behavior unchanged.
 */
export function SIPrefix(unit: UnitLike, offset = 0): ValueFormatter {
  const localized = typeof unit === 'function';
  return (size: number, decimals?: DecimalCount, scaledDecimals?: DecimalCount) => {
    const base = resolveUnit(unit);
    const prefixes = localized ? getSIPrefixSymbols() : SI_PREFIXES;
    const units = prefixes.map((p) => ' ' + p + base);
    return scaledUnits(1000, units, SI_BASE_INDEX + offset)(size, decimals, scaledDecimals);
  };
}
