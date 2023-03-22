import { DecimalCount } from '../types/displayValue';

import { toFixed, FormattedValue } from './valueFormats';

export function toPercent(size: number | null, decimals: DecimalCount): FormattedValue {
  if (size === null) {
    return { text: '' };
  }
  return { text: toFixed(size, decimals), suffix: '%' };
}

export function toPercentUnit(size: number | null, decimals: DecimalCount): FormattedValue {
  if (size === null) {
    return { text: '' };
  }
  return { text: toFixed(100 * size, decimals), suffix: '%' };
}

export function toHex0x(value: number | null, decimals: DecimalCount): FormattedValue {
  if (value == null) {
    return { text: '' };
  }
  const asHex = toHex(value, decimals);
  if (asHex.text.substring(0, 1) === '-') {
    asHex.text = '-0x' + asHex.text.substring(1);
  } else {
    asHex.text = '0x' + asHex.text;
  }
  return asHex;
}

export function toHex(value: number | null, decimals: DecimalCount): FormattedValue {
  if (value == null) {
    return { text: '' };
  }
  return {
    text: parseFloat(toFixed(value, decimals)).toString(16).toUpperCase(),
  };
}

export function sci(value: number | null, decimals: DecimalCount): FormattedValue {
  if (value == null) {
    return { text: '' };
  }
  return { text: value.toExponential(decimals ?? undefined) };
}
