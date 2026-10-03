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

// i18next silently substitutes this for a resolved ordinal category (e.g. Italian's "many", used
// for numbers like 8, 11, 18 and 80) that has neither its own translation nor its own
// defaultValue_ordinal_* below — it isn't a real suffix, only used to detect that case (see below).
const UNTRANSLATED_ORDINAL_CATEGORY = '\u0000';

function ordinalSuffix(value: number): string {
  // Delegates to Intl.PluralRules (via i18next's `ordinal` option) so the suffix follows each
  // locale's own ordinal rules (e.g. English's 1st/2nd/3rd/4th) instead of assuming English.
  const suffix = t('grafana-data.valueFormats.ordinal-suffix', '', {
    count: value,
    ordinal: true,
    // These two cardinal defaults are never used for cardinal pluralization here (we always pass
    // `ordinal: true`) — they only exist to satisfy the t-plural-defaults lint rule. i18next also
    // uses them as a silent fallback when the resolved ordinal category has no defaultValue_ordinal_*
    // of its own below, which we turn into the detection sentinel above.
    defaultValue_one: UNTRANSLATED_ORDINAL_CATEGORY,
    defaultValue_other: UNTRANSLATED_ORDINAL_CATEGORY,
    defaultValue_ordinal_one: 'st',
    defaultValue_ordinal_two: 'nd',
    defaultValue_ordinal_few: 'rd',
    defaultValue_ordinal_other: 'th',
  });

  if (suffix !== UNTRANSLATED_ORDINAL_CATEGORY) {
    return suffix;
  }

  // Extraction only walks en-US's own ordinal categories (one/two/few/other), so a category like
  // Italian's "many" never gets a translatable key of its own, and Crowdin's i18next plural
  // support doesn't reliably create one either. Reuse the locale's own "other" suffix instead of
  // leaking English, since ordinal suffixes rarely vary by category outside English anyway.
  return t('grafana-data.valueFormats.ordinal-suffix_ordinal_other', 'th');
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
