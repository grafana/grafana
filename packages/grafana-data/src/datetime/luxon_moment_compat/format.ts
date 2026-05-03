import type { DateTime } from 'luxon';

const TOKEN_MAP: Record<string, string> = {
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
  HH: 'HH',
  H: 'H',
  hh: 'hh',
  h: 'h',
  mm: 'mm',
  m: 'm',
  ss: 'ss',
  s: 's',
  A: 'a',
  a: "'__mls__'a'__mle__'",

  ZZ: 'Z',
  Z: 'ZZ',
  z: 'ZZZZ',
  zz: 'ZZZZZ',

  T: "'T'",
};

const TOKEN_PATTERN = new RegExp(`\\[([^\\]]+)\\]|Do|${Object.keys(TOKEN_MAP).join('|')}`, 'g');
const ORDINAL_MARKER = '__ord__';
const ORDINAL_MARKER_PATTERN = new RegExp(`(\\d+)${ORDINAL_MARKER}`, 'g');
const LOWER_MERIDIEM_MARKER_PATTERN = /__mls__(.*?)__mle__/g;
const ORDINAL_SUFFIXES = ['th', 'st', 'nd', 'rd'] as const;

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
  return format.replace(TOKEN_PATTERN, replaceMomentToken);
}

export function getOrdinal(day: number): string {
  const value = day % 100;
  return ORDINAL_SUFFIXES[(value - 20) % 10] ?? ORDINAL_SUFFIXES[value] ?? 'th';
}

export function formatWithOrdinal(luxonDateTime: DateTime, momentFormat: string): string {
  const luxonFormat = convertMomentToLuxonWithOrdinal(momentFormat);
  // ZZZZ doesnt work
  // https://github.com/moment/luxon/discussions/1041
  // https://github.com/moment/luxon/issues/499#issuecomment-865017957
  // https://github.com/facebook/hermes/issues/1601
  // console.log(luxonDateTime.offsetNameShort);
  const formatted = luxonDateTime.toFormat(luxonFormat);

  // Global regexes carry `lastIndex`; reset so repeated calls are deterministic.
  ORDINAL_MARKER_PATTERN.lastIndex = 0;

  const withOrdinals = formatted.replace(ORDINAL_MARKER_PATTERN, (_: string, rawDay: string) => {
    const day = parseInt(rawDay, 10);
    return `${rawDay}${getOrdinal(day)}`;
  });

  // Moment's `a` is lowercase meridiem while Luxon's `a` is uppercase.
  return withOrdinals.replace(LOWER_MERIDIEM_MARKER_PATTERN, (_: string, meridiem: string) => meridiem.toLowerCase());
}
