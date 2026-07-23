import type { DateTime } from 'luxon';

const TOKEN_MAP: Record<string, string> = {
  // moment's L* tokens are locale-aware (word order changes per locale), so map them to luxon's
  // localized macro tokens rather than fixed patterns. `L` and `llll` have no exact luxon macro
  // (`D` is unpadded while moment's `L` pads, and no macro uses an abbreviated weekday), so they
  // keep en-US shaped patterns.
  LLLL: 'DDDD t',
  LLL: 'DDD t',
  LL: 'DDD',
  LTS: 'tt',
  LT: 't',
  L: 'MM/dd/yyyy',
  llll: 'ccc, LLL d, yyyy h:mm a',
  lll: 'DD t',
  ll: 'DD',
  l: 'D',

  YYYY: 'yyyy',
  YY: 'yy',
  MMMM: 'LLLL',
  MMM: 'LLL',
  MM: 'LL',
  M: 'L',
  DD: 'dd',
  D: 'd',
  dddd: 'cccc',
  ddd: 'ccc',
  // HH/H, hh/h, mm/m, ss/s are identical in moment and luxon and pass through unmapped
  A: 'a',
  a: "'__mls__'a'__mle__'",

  ZZ: 'ZZZ',
  Z: 'ZZ',
  z: 'ZZZZ',
  zz: 'ZZZZZ',

  T: "'T'",
};

const TOKEN_PATTERN = new RegExp(`\\[([^\\]]+)\\]|Do|${Object.keys(TOKEN_MAP).join('|')}`, 'g');
const ORDINAL_MARKER = '__ord__';
const ORDINAL_MARKER_PATTERN = new RegExp(`(\\d+)${ORDINAL_MARKER}`, 'g');
const MERIDIEM_START_MARKER = '__mls__';
const LOWER_MERIDIEM_MARKER_PATTERN = /__mls__(.*?)__mle__/g;
const ORDINAL_SUFFIXES = ['th', 'st', 'nd', 'rd'] as const;

interface ConvertedFormat {
  luxonFormat: string;
  hasOrdinal: boolean;
  hasMeridiem: boolean;
}

// format conversion runs on every format() call in hot paths (table cells, axis ticks) and format
// strings are highly repetitive, so cache the regex work. Keys only come from config/code-supplied
// format strings, so the cache stays small for the lifetime of the page.
const convertedFormatCache = new Map<string, ConvertedFormat>();

function convertFormat(format: string): ConvertedFormat {
  let converted = convertedFormatCache.get(format);

  if (!converted) {
    // Moment escapes literals using backslashes while Luxon expects quoted literals.
    // Normalize `\x` to `[x]` first so we can reuse the existing escaped-text handling.
    const withEscapedLiterals = format.replace(/\\(.)/g, '[$1]');
    const luxonFormat = withEscapedLiterals.replace(TOKEN_PATTERN, replaceMomentToken);

    converted = {
      luxonFormat,
      hasOrdinal: luxonFormat.includes(ORDINAL_MARKER),
      hasMeridiem: luxonFormat.includes(MERIDIEM_START_MARKER),
    };
    convertedFormatCache.set(format, converted);
  }

  return converted;
}

function replaceMomentToken(match: string, escapedText?: string): string {
  if (escapedText != null) {
    return `'${escapedText}'`;
  }

  if (match === 'Do') {
    return `d'${ORDINAL_MARKER}'`;
  }

  return TOKEN_MAP[match] ?? match;
}

export function convertMomentToLuxonWithOrdinal(format: string): string {
  return convertFormat(format).luxonFormat;
}

function getOrdinal(day: number): string {
  const value = day % 100;
  return ORDINAL_SUFFIXES[(value - 20) % 10] ?? ORDINAL_SUFFIXES[value] ?? 'th';
}

export function formatWithOrdinal(luxonDateTime: DateTime, momentFormat: string): string {
  const { luxonFormat, hasOrdinal, hasMeridiem } = convertFormat(momentFormat);
  // ZZZZ doesnt work
  // https://github.com/moment/luxon/discussions/1041
  // https://github.com/moment/luxon/issues/499#issuecomment-865017957
  // https://github.com/facebook/hermes/issues/1601
  // console.log(luxonDateTime.offsetNameShort);
  let formatted = luxonDateTime.toFormat(luxonFormat);

  if (hasOrdinal) {
    formatted = formatted.replace(ORDINAL_MARKER_PATTERN, (_: string, rawDay: string) => {
      const day = parseInt(rawDay, 10);
      return `${rawDay}${getOrdinal(day)}`;
    });
  }

  if (hasMeridiem) {
    // Moment's `a` is lowercase meridiem while Luxon's `a` is uppercase.
    formatted = formatted.replace(LOWER_MERIDIEM_MARKER_PATTERN, (_: string, meridiem: string) => meridiem.toLowerCase());
  }

  return formatted;
}
