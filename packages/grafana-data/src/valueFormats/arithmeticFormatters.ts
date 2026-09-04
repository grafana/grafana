import { type DecimalCount } from '../types/displayValue';
import { type FormattedValue } from '../types/valueFormats';

import { toFixed } from './baseFormatters';

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

function ordinalSuffix(value: number): string {
  const lastTwoDigits = Math.abs(value) % 100;

  // 11th, 12th and 13th break the last-digit rule, as do 111th, 212th and so on.
  if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
    return 'th';
  }

  switch (lastTwoDigits % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}

export function toOrdinal(value: number | null): FormattedValue {
  if (value == null) {
    return { text: '' };
  }

  if (!isFinite(value)) {
    return { text: value.toLocaleString() };
  }

  // Ordinals are only meaningful for whole numbers, so the decimals option is deliberately ignored.
  const rounded = Math.round(value);

  return { text: `${rounded}`, suffix: ordinalSuffix(rounded) };
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
