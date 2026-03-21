import { DateTime as LuxonDateTime } from 'luxon';

import { FormatInput, ISO_8601 } from '../types';

import { looseMomentParseFormat } from './loose-moment-parse-format';
import { toLuxonFormat } from './moment-to-luxon-format-tokens';

const inputHasZone = (value: string) => /(?:Z|[+-]\d{2}(?::?\d{2})?)$/.test(value);

const parseFormatPrefix = (input: string, format: string, zone: string | undefined, locale: string) => {
  const prefix = looseMomentParseFormat(input, format);
  if (!prefix) {
    return undefined;
  }

  return LuxonDateTime.fromFormat(prefix, format, {
    zone: zone ?? undefined,
    locale,
    setZone: Boolean(zone),
  });
};

export const looseMomentParseString = (
  input: string,
  formatInput: FormatInput,
  zone: string | undefined,
  locale: string
) => {
  if (!formatInput) {
    const iso = LuxonDateTime.fromISO(input, { zone: zone ?? undefined, setZone: true, locale });
    if (iso.isValid) {
      return zone && !inputHasZone(input) ? iso.setZone(zone, { keepLocalTime: true }) : iso;
    }

    const jsDate = new Date(input);
    return Number.isNaN(jsDate.valueOf())
      ? LuxonDateTime.invalid('Invalid date')
      : LuxonDateTime.fromJSDate(jsDate, { zone: zone ?? undefined }).setLocale(locale);
  }

  if (formatInput === ISO_8601) {
    const iso = LuxonDateTime.fromISO(input, { zone: zone ?? undefined, setZone: true, locale });
    return zone && !inputHasZone(input) ? iso.setZone(zone, { keepLocalTime: true }) : iso;
  }

  if (inputHasZone(input) && input.includes('T')) {
    const iso = LuxonDateTime.fromISO(input, { zone: zone ?? undefined, setZone: true, locale });
    if (iso.isValid) {
      return zone && !inputHasZone(input) ? iso.setZone(zone, { keepLocalTime: true }) : iso;
    }
  }

  const format = String(formatInput);
  const variants: Array<{ input: string; format: string }> = [
    { input, format: toLuxonFormat(format) },
    { input, format: toLuxonFormat(format).replace(/LLLL/g, 'MMM').replace(/cccc/g, 'ccc') },
    { input: input.replace(/,/g, ''), format: toLuxonFormat(format).replace(/,/g, '').replace(/LLLL/g, 'MMM') },
  ];
  for (const candidate of variants) {
    const parsed = LuxonDateTime.fromFormat(candidate.input, candidate.format, {
      zone: zone ?? undefined,
      locale,
      setZone: Boolean(zone),
    });

    if (parsed.isValid) {
      return parsed;
    }

    const prefixParsed = parseFormatPrefix(candidate.input, candidate.format, zone, locale);
    if (prefixParsed?.isValid) {
      return prefixParsed;
    }
  }

  return LuxonDateTime.invalid('Invalid date');
};
