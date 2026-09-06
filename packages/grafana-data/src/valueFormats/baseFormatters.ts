import { clamp } from 'lodash';

import { type DecimalCount } from '../types/displayValue';
import { type FormattedValue, type ValueFormatter } from '../types/valueFormats';

export function formattedValueToString(val: FormattedValue): string {
  return `${val.prefix ?? ''}${val.text}${val.suffix ?? ''}`;
}

export function toFixed(value: number, decimals?: DecimalCount): string {
  if (value === null) {
    return '';
  }

  if (value === Number.NEGATIVE_INFINITY || value === Number.POSITIVE_INFINITY) {
    return value.toLocaleString();
  }

  if (decimals === null || decimals === undefined) {
    decimals = getDecimalsForValue(value);
  }

  if (value === 0) {
    return value.toFixed(decimals);
  }

  const factor = decimals ? Math.pow(10, Math.max(0, decimals)) : 1;
  const formatted = String(Math.round(value * factor) / factor);

  // if exponent return directly
  if (formatted.indexOf('e') !== -1 || value === 0) {
    return formatted;
  }

  const decimalPos = formatted.indexOf('.');
  const precision = decimalPos === -1 ? 0 : formatted.length - decimalPos - 1;
  if (precision < decimals) {
    return (precision ? formatted : formatted + '.') + String(factor).slice(1, decimals - precision + 1);
  }

  return formatted;
}

function getDecimalsForValue(value: number): number {
  const absValue = Math.abs(value);
  const log10 = Math.floor(Math.log(absValue) / Math.LN10);
  let dec = -log10 + 1;
  const magn = Math.pow(10, -dec);
  const norm = absValue / magn; // norm is between 1.0 and 10.0

  // special case for 2.5, requires an extra decimal
  if (norm > 2.25) {
    ++dec;
  }

  if (value % 1 === 0) {
    dec = 0;
  }

  const decimals = Math.max(0, dec);
  return decimals;
}

/**
 * A unit's short display text can either be a plain string (the legacy shape,
 * still accepted so third-party plugins and existing callers of the public
 * `@grafana/data` formatter factories keep working unchanged), or a thunk
 * that is invoked every time a value is formatted.
 *
 * Using a thunk lets a caller defer the string to `t()` from `@grafana/i18n`
 * so the *rendered* text (not just the picker's dropdown label) tracks the
 * current locale — without requiring the `getValueFormat()` index cache in
 * `valueFormats.ts` to be rebuilt when the user switches languages. See
 * `categories.ts` / `unitSymbols.ts` for how the built-in unit categories use
 * this.
 */
export type UnitLike = string | (() => string);

export function resolveUnit(unit: UnitLike): string {
  return typeof unit === 'function' ? unit() : unit;
}

export function toFixedScaled(value: number, decimals: DecimalCount, ext?: UnitLike): FormattedValue {
  return {
    text: toFixed(value, decimals),
    suffix: appendPluralIf(ext === undefined ? undefined : resolveUnit(ext), Math.abs(value) > 1),
  };
}

function appendPluralIf(ext: string | undefined, condition: boolean): string | undefined {
  if (!condition) {
    return ext;
  }

  switch (ext) {
    case ' min':
    case ' hour':
    case ' day':
    case ' week':
    case ' year':
      return `${ext}s`;
    default:
      return ext;
  }
}

export function toFixedUnit(unit: UnitLike, asPrefix?: boolean): ValueFormatter {
  return (size: number, decimals?: DecimalCount) => {
    if (size === null) {
      return { text: '' };
    }
    const text = toFixed(size, decimals);
    const resolvedUnit = resolveUnit(unit);
    if (resolvedUnit) {
      if (asPrefix) {
        return { text, prefix: resolvedUnit };
      }
      return { text, suffix: ' ' + resolvedUnit };
    }
    return { text };
  };
}

export function isBooleanUnit(unit?: string) {
  return unit && unit.startsWith('bool');
}

export function booleanValueFormatter(t: UnitLike, f: UnitLike): ValueFormatter {
  return (value) => {
    return { text: resolveUnit(value ? t : f) };
  };
}

const logb = (b: number, x: number) => Math.log10(x) / Math.log10(b);

/**
 * `extArray` can be a fixed list of suffixes (legacy shape) or a thunk
 * returning the list, evaluated on every call — used by the built-in
 * categories to keep e.g. the "short" (K/M/B/T…) magnitude words localized.
 */
export function scaledUnits(factor: number, extArray: string[] | (() => string[]), offset = 0): ValueFormatter {
  return (size: number, decimals?: DecimalCount) => {
    if (size === null || size === undefined) {
      return { text: '' };
    }

    if (size === Number.NEGATIVE_INFINITY || size === Number.POSITIVE_INFINITY || isNaN(size)) {
      return { text: size.toLocaleString() };
    }

    const resolvedExtArray = typeof extArray === 'function' ? extArray() : extArray;
    const siIndex = size === 0 ? 0 : Math.floor(logb(factor, Math.abs(size)));
    const suffix = resolvedExtArray[clamp(offset + siIndex, 0, resolvedExtArray.length - 1)];

    return {
      text: toFixed(size / factor ** clamp(siIndex, -offset, resolvedExtArray.length - offset - 1), decimals),
      suffix,
    };
  };
}

export function locale(value: number, decimals: DecimalCount): FormattedValue {
  if (value == null) {
    return { text: '' };
  }
  return {
    text: value.toLocaleString(undefined, { maximumFractionDigits: decimals ?? undefined }),
  };
}

export function simpleCountUnit(symbol: UnitLike): ValueFormatter {
  const units = ['', 'K', 'M', 'B', 'T'];
  const scaler = scaledUnits(1000, units);
  return (size: number, decimals?: DecimalCount, scaledDecimals?: DecimalCount) => {
    if (size === null) {
      return { text: '' };
    }
    const v = scaler(size, decimals, scaledDecimals);
    v.suffix += ' ' + resolveUnit(symbol);
    return v;
  };
}

export function stringFormater(value: number): FormattedValue {
  return { text: `${value}` };
}
