import { t } from '@grafana/i18n';

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
  // Delegates to Intl.PluralRules (via i18next's `ordinal` option) so the suffix follows each
  // locale's own ordinal rules (e.g. English's 1st/2nd/3rd/4th) instead of assuming English.
  return t('grafana-data.valueFormats.ordinal-suffix', '', {
    count: value,
    ordinal: true,
    // Cardinal fallbacks required by the t-plural-defaults lint rule; i18next only falls back to
    // these if a locale is missing the ordinal-specific defaults above, which none do here.
    defaultValue_one: 'st',
    defaultValue_other: 'th',
    defaultValue_ordinal_one: 'st',
    defaultValue_ordinal_two: 'nd',
    defaultValue_ordinal_few: 'rd',
    // Italian's ordinal rule resolves to "many" for numbers like 8, 11, 18 and 80 — without this,
    // those numbers would silently fall back to the "other" suffix once Italian is translated.
    defaultValue_ordinal_many: 'th',
    defaultValue_ordinal_other: 'th',
  });
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
