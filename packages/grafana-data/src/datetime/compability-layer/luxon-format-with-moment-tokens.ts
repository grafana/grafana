import { DateTime as LuxonDateTime } from 'luxon';

import { toLuxonFormat } from './moment-to-luxon-format-tokens';

const zonePlaceholder = '¤0¤';
const zonePlaceholderRegexp = new RegExp(zonePlaceholder, 'g');
const lowerMeridiemPlaceholder = '¤1¤';
const lowerMeridiemPlaceholderRegexp = new RegExp(lowerMeridiemPlaceholder, 'g');
const upperMeridiemPlaceholder = '¤2¤';
const upperMeridiemPlaceholderRegexp = new RegExp(upperMeridiemPlaceholder, 'g');

const injectFormatPlaceholders = (
  format: string,
  zonePlaceholder: string,
  lowerMeridiemPlaceholder: string,
  upperMeridiemPlaceholder: string
) => {
  let output = '';

  for (let i = 0; i < format.length; i++) {
    if (format[i] === '\\' && i + 1 < format.length) {
      output += format[i] + format[i + 1];
      i++;
      continue;
    }

    switch (format[i]) {
      case 'z':
        output += zonePlaceholder;
        break;
      case 'a':
        output += lowerMeridiemPlaceholder;
        break;
      case 'A':
        output += upperMeridiemPlaceholder;
        break;
      default:
        output += format[i];
    }
  }

  return output;
};

const getTimeZoneAbbreviation = (value: LuxonDateTime) => {
  const zoneName = value.zoneName ?? 'UTC';
  const date = value.toJSDate();

  try {
    // TODO(perf): This is heavy and in future should be replaced by a cached map lookup
    const abbreviation = new Intl.DateTimeFormat('en-US', {
      timeZone: zoneName,
      timeZoneName: 'short',
    })
      .formatToParts(date)
      .find((part) => part.type === 'timeZoneName')?.value;

    if (abbreviation) {
      return abbreviation;
    }
  } catch {
    // Ignore invalid Intl timezone formatting and fall through to Luxon.
  }

  return value.offsetNameShort || 'UTC';
};

/**
 * Luxon formatting is not a drop-in replacement for Moment-style output tokens.
 *
 * Grafana still accepts Moment-compatible format strings across public APIs, and callers
 * expect tokens like `a`, `A`, and `z` to keep their Moment behavior after the Luxon
 * migration. This helper preserves that compatibility by converting the format for Luxon,
 * formatting once, and then substituting the affected token values back into the output.
 */
export const formatWithMomentTokens = (value: LuxonDateTime, format: string) => {
  const luxonFormat = toLuxonFormat(
    injectFormatPlaceholders(format, zonePlaceholder, lowerMeridiemPlaceholder, upperMeridiemPlaceholder)
  );

  const meridiem = value.toFormat('a');
  return value
    .toFormat(luxonFormat)
    .replace(lowerMeridiemPlaceholderRegexp, meridiem.toLowerCase())
    .replace(upperMeridiemPlaceholderRegexp, meridiem.toUpperCase())
    .replace(zonePlaceholderRegexp, getTimeZoneAbbreviation(value));
};
