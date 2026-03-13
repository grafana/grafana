import { clamp } from 'lodash';

import { DecimalCount } from '../types/displayValue';
import { TimeZone } from '../types/time';

import { getCategories } from './categories';
import { toDateTimeValueFormatter } from './dateTimeFormatters';
import { getOffsetFromSIPrefix, SIPrefix, currency, fullCurrency } from './symbolFormatters';

export interface FormattedValue {
  text: string;
  prefix?: string;
  suffix?: string;
}

export function formattedValueToString(val: FormattedValue): string {
  return `${val.prefix ?? ''}${val.text}${val.suffix ?? ''}`;
}

export type ValueFormatter = (
  value: number,
  decimals?: DecimalCount,
  scaledDecimals?: DecimalCount,
  timeZone?: TimeZone,
  showMs?: boolean
) => FormattedValue;

export interface ValueFormat {
  name: string;
  id: string;
  fn: ValueFormatter;
}

export interface ValueFormatCategory {
  name: string;
  formats: ValueFormat[];
}

export interface ValueFormatterIndex {
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

  if (value === Number.NEGATIVE_INFINITY || value === Number.POSITIVE_INFINITY) {
    return value.toLocaleString();
  }

  const wasDecimalsUndefined = decimals === null || decimals === undefined;
  let actualDecimals: number;
  if (wasDecimalsUndefined) {
    actualDecimals = getDecimalsForValue(value);
  } else {
    actualDecimals = decimals;
  }

  if (value === 0) {
    return value.toFixed(actualDecimals);
  }

  const factor = actualDecimals ? Math.pow(10, Math.max(0, actualDecimals)) : 1;
  const formatted = String(Math.round(value * factor) / factor);

  // if exponent return directly
  if (formatted.indexOf('e') !== -1 || value === 0) {
    return formatted;
  }

  const decimalPos = formatted.indexOf('.');
  const precision = decimalPos === -1 ? 0 : formatted.length - decimalPos - 1;
  if (precision < actualDecimals) {
    return (precision ? formatted : formatted + '.') + String(factor).slice(1, actualDecimals - precision + 1);
  }

  return formatted;
}

function getDecimalsForValue(value: number): number {
  // If Y-axis range context is available, use range-based algorithm
  if (yAxisRangeContext) {
    let deltaY = yAxisRangeContext.max - yAxisRangeContext.min;

    // If range is zero, return default decimals
    if (deltaY === 0) {
      return 6;
    }

    // Detect if value has been scaled by unit prefix (K, M, B, etc.)
    // This happens when formatters like scaledUnits divide the value before calling toFixed
    const absValue = Math.abs(value);
    const absRangeCenter = Math.abs((yAxisRangeContext.max + yAxisRangeContext.min) / 2);

    // If value is significantly smaller than the range, it's been scaled
    if (absValue > 0 && absRangeCenter > 0) {
      const ratio = absRangeCenter / absValue;

      // Check if ratio suggests scaling by K, M, B, etc. (powers of 1000)
      if (ratio > 100) {
        // Estimate the scale factor (round to nearest power of 1000)
        // For K: ratio ~1000, M: ratio ~1000000, etc.
        const logRatio = Math.log10(ratio);
        const scaleSteps = Math.round(logRatio / 3); // 3 because log10(1000) = 3

        if (scaleSteps > 0) {
          const scaleFactor = Math.pow(1000, scaleSteps);
          const adjustedDeltaY = deltaY / scaleFactor;
          deltaY = adjustedDeltaY;
        }
      }
    }

    // Calculate the exponent (E) of the range's order of magnitude
    const E = Math.floor(Math.log10(deltaY));

    // Optimal Decimal Places (DP) = 3 - E
    const dpUnclamped = 3 - E;

    // Ensure DP is never negative (minimum DP is 0)
    const dp = Math.max(0, dpUnclamped);

    return dp;
  }

  // Fallback to original algorithm when no Y-axis context
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

export function toFixedScaled(value: number, decimals: DecimalCount, ext?: string): FormattedValue {
  return {
    text: toFixed(value, decimals),
    suffix: appendPluralIf(ext, Math.abs(value) > 1),
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

export function toFixedUnit(unit: string, asPrefix?: boolean): ValueFormatter {
  return (size: number, decimals?: DecimalCount) => {
    if (size === null) {
      return { text: '' };
    }
    const text = toFixed(size, decimals);
    if (unit) {
      if (asPrefix) {
        return { text, prefix: unit };
      }
      return { text, suffix: ' ' + unit };
    }
    return { text };
  };
}

export function isBooleanUnit(unit?: string) {
  return unit && unit.startsWith('bool');
}

export function booleanValueFormatter(t: string, f: string): ValueFormatter {
  return (value) => {
    return { text: value ? t : f };
  };
}

const logb = (b: number, x: number) => Math.log10(x) / Math.log10(b);

// Y-axis range context for tooltip decimal calculation
let yAxisRangeContext: { min: number; max: number } | null = null;

/**
 * Set Y-axis range context for decimal calculation.
 * This should be called before formatting tooltip values.
 */
export function setYAxisRangeContext(yMin: number, yMax: number) {
  yAxisRangeContext = { min: yMin, max: yMax };
}

/**
 * Clear Y-axis range context after tooltip rendering.
 */
export function clearYAxisRangeContext() {
  yAxisRangeContext = null;
}

export function scaledUnits(factor: number, extArray: string[], offset = 0): ValueFormatter {
  return (size: number, decimals?: DecimalCount) => {
    if (size === null || size === undefined) {
      return { text: '' };
    }

    if (size === Number.NEGATIVE_INFINITY || size === Number.POSITIVE_INFINITY || isNaN(size)) {
      return { text: size.toLocaleString() };
    }

    const siIndex = size === 0 ? 0 : Math.floor(logb(factor, Math.abs(size)));
    const suffix = extArray[clamp(offset + siIndex, 0, extArray.length - 1)];

    return {
      text: toFixed(size / factor ** clamp(siIndex, -offset, extArray.length - offset - 1), decimals),
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

export function simpleCountUnit(symbol: string): ValueFormatter {
  const units = ['', 'K', 'M', 'B', 'T'];
  const scaler = scaledUnits(1000, units);
  return (size: number, decimals?: DecimalCount, scaledDecimals?: DecimalCount) => {
    if (size === null) {
      return { text: '' };
    }
    const v = scaler(size, decimals, scaledDecimals);
    v.suffix += ' ' + symbol;
    return v;
  };
}

export function stringFormater(value: number): FormattedValue {
  return { text: `${value}` };
}

function buildFormats() {
  categories = getCategories();

  for (const cat of categories) {
    for (const format of cat.formats) {
      index[format.id] = format.fn;
    }
  }

  // Resolve units pointing to old IDs
  [{ from: 'farenheit', to: 'fahrenheit' }].forEach((alias) => {
    const f = index[alias.to];
    if (f) {
      index[alias.from] = f;
    }
  });

  hasBuiltIndex = true;
}

export function getValueFormat(id?: string | null): ValueFormatter {
  if (!id) {
    return toFixedUnit('');
  }

  if (!hasBuiltIndex) {
    buildFormats();
  }

  const fmt = index[id];

  if (!fmt && id) {
    let idx = id.indexOf(':');

    if (idx > 0) {
      const key = id.substring(0, idx);
      const sub = id.substring(idx + 1);

      if (key === 'prefix') {
        return toFixedUnit(sub, true);
      }

      if (key === 'suffix') {
        return toFixedUnit(sub, false);
      }

      if (key === 'time') {
        return toDateTimeValueFormatter(sub);
      }

      if (key === 'si') {
        const offset = getOffsetFromSIPrefix(sub.charAt(0));
        const unit = offset === 0 ? sub : sub.substring(1);
        return SIPrefix(unit, offset);
      }

      if (key === 'count') {
        return simpleCountUnit(sub);
      }

      // Supported formats:
      // currency:$           -> scaled currency ($1.2K)
      // currency:financial:$ -> full currency ($1,234)
      // currency:financial:€:suffix -> full currency with suffix (1,234€)
      if (key === 'currency') {
        const keySplit = sub.split(':');

        if (keySplit[0] === 'financial' && keySplit.length >= 2) {
          const symbol = keySplit[1];
          if (!symbol) {
            return toFixedUnit(''); // fallback for empty symbol
          }
          const asSuffix = keySplit[2] === 'suffix';
          return fullCurrency(symbol, asSuffix);
        } else {
          return currency(sub);
        }
      }

      if (key === 'bool') {
        idx = sub.indexOf('/');
        if (idx >= 0) {
          const t = sub.substring(0, idx);
          const f = sub.substring(idx + 1);
          return booleanValueFormatter(t, f);
        }
        return booleanValueFormatter(sub, '-');
      }
    }

    return toFixedUnit(id);
  }

  return fmt;
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

  return categories.map((cat) => {
    return {
      text: cat.name,
      submenu: cat.formats.map((format) => {
        return {
          text: format.name,
          value: format.id,
        };
      }),
    };
  });
}
