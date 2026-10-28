import { DateTime } from './luxon';

const LOWER_MERIDIEM_FORMAT = "'__mls__'a'__mle__'";
const ONE_TO_TWENTY_FOUR_HOUR_FORMAT = "'__khs__'H'__khe__'";
const PADDED_ONE_TO_TWENTY_FOUR_HOUR_FORMAT = "'__khs__'HH'__khe__'";

const TOKEN_MAP: Record<string, string> = {
  // moment's L* tokens are locale-aware (word order changes per locale), so map them to luxon's
  // localized macro tokens rather than fixed patterns. `L` and `llll` use generated Intl patterns
  // for padded dates and abbreviated weekdays, respectively.
  LLLL: 'DDDD t',
  LLL: 'DDD t',
  LL: 'DDD',
  LTS: 'tt',
  LT: 't',
  L: 'MM/dd/yyyy',
  llll: 'ccc, DD t',
  lll: 'DD t',
  ll: 'DD',
  l: 'D',

  YYYY: 'yyyy',
  YY: 'yy',
  Q: 'q',
  MMMM: 'LLLL',
  MMM: 'LLL',
  MM: 'LL',
  M: 'L',
  DDDD: 'ooo',
  DDD: 'o',
  DD: 'dd',
  D: 'd',
  dddd: 'cccc',
  ddd: 'ccc',
  dd: "'__weekdayMin__'",
  d: "'__weekdayNumber__'",
  // HH/H, hh/h, mm/m, ss/s are identical in moment and luxon and pass through unmapped.
  // Moment's k/kk clock runs from 1-24, while Luxon's H/HH clock runs from 0-23.
  kk: PADDED_ONE_TO_TWENTY_FOUR_HOUR_FORMAT,
  k: ONE_TO_TWENTY_FOUR_HOUR_FORMAT,
  A: 'a',
  a: LOWER_MERIDIEM_FORMAT,

  GG: 'kk',
  SSSSSSSSS: "u'000000'",
  SSSSSSSS: "u'00000'",
  SSSSSSS: "u'0000'",
  SSSSSS: "u'000'",
  SSSSS: "u'00'",
  SSSS: "u'0'",
  SSS: 'u',
  SS: 'uu',
  S: 'uuu',

  ZZ: 'ZZZ',
  Z: 'ZZ',
  z: 'ZZZZ',
  zz: 'ZZZZZ',

  T: "'T'",
};

const PARSING_TOKEN_MAP: Record<string, string> = {
  ...TOKEN_MAP,
  // Moment's forgiving parser reads one or two digits for these, while Luxon's padded tokens need two.
  MM: 'L',
  DD: 'd',
  HH: 'H',
  hh: 'h',
  mm: 'm',
  ss: 's',
  dd: 'ccc',
  d: 'c',
  kk: 'H',
  k: 'H',
  SSSSSSSSS: 'u',
  SSSSSSSS: 'u',
  SSSSSSS: 'u',
  SSSSSS: 'u',
  SSSSS: 'u',
  SSSS: 'u',
  SSS: 'u',
};

// Two-digit output for the same tokens, used to format a fallback parse so it can be parsed again.
const PADDED_PARSING_TOKEN_MAP: Record<string, string> = {
  ...PARSING_TOKEN_MAP,
  MM: 'LL',
  DD: 'dd',
  HH: 'HH',
  hh: 'hh',
  mm: 'mm',
  ss: 'ss',
  kk: 'HH',
};

const TOKEN_PATTERN = new RegExp(
  `\\[([^\\]]+)\\]|'|Do|${Object.keys(PARSING_TOKEN_MAP)
    .sort((a, b) => b.length - a.length)
    .join('|')}`,
  'g'
);
const ORDINAL_MARKER = '__ord__';
const ORDINAL_MARKER_PATTERN = new RegExp(`(\\d+)${ORDINAL_MARKER}`, 'g');
const MERIDIEM_START_MARKER = '__mls__';
const LOWER_MERIDIEM_MARKER_PATTERN = /__mls__(.*?)__mle__/g;
const ONE_TO_TWENTY_FOUR_HOUR_MARKER = '__khs__';
const ONE_TO_TWENTY_FOUR_HOUR_MARKER_PATTERN = /__khs__(\d{1,2})__khe__/g;
const ORDINAL_SUFFIXES = ['th', 'st', 'nd', 'rd'] as const;
const WEEKDAY_MARKER_PATTERN = /__weekday(Number|Min)__/g;

interface ConvertedFormat {
  luxonFormat: string;
  hasOrdinal: boolean;
  hasMeridiem: boolean;
  hasOneToTwentyFourHour: boolean;
  hasWeekday: boolean;
}

// format conversion runs on every format() call in hot paths (table cells, axis ticks) and format
// strings are highly repetitive, so cache the regex work. Keys come from config/code-supplied
// format strings and locales, so the cache stays small for the lifetime of the page.
const convertedFormatCache = new Map<string, ConvertedFormat>();

type ConversionMode = 'format' | 'parse' | 'paddedParse';

const TOKEN_MAPS: Record<ConversionMode, Record<string, string>> = {
  format: TOKEN_MAP,
  parse: PARSING_TOKEN_MAP,
  paddedParse: PADDED_PARSING_TOKEN_MAP,
};

function convertFormat(
  format: string,
  omitZoneName = false,
  mode: ConversionMode = 'format',
  locale = 'en-US'
): ConvertedFormat {
  const cacheKey = `${mode}|${omitZoneName ? 'local' : 'zoned'}|${locale}|${format}`;
  let converted = convertedFormatCache.get(cacheKey);

  if (!converted) {
    // Moment escapes literals using backslashes while Luxon expects quoted literals.
    // Normalize `\x` to `[x]` first so we can reuse the existing escaped-text handling.
    const withEscapedLiterals = format.replace(/\\(.)/g, '[$1]');
    const luxonFormat = withEscapedLiterals.replace(TOKEN_PATTERN, (match, escapedText?: string) =>
      replaceMomentToken(match, escapedText, omitZoneName, mode, locale)
    );

    converted = {
      luxonFormat,
      hasOrdinal: luxonFormat.includes(ORDINAL_MARKER),
      hasMeridiem: luxonFormat.includes(MERIDIEM_START_MARKER),
      hasOneToTwentyFourHour: luxonFormat.includes(ONE_TO_TWENTY_FOUR_HOUR_MARKER),
      hasWeekday: luxonFormat.includes('__weekday'),
    };
    convertedFormatCache.set(cacheKey, converted);
  }

  return converted;
}

function replaceMomentToken(
  match: string,
  escapedText?: string,
  omitZoneName = false,
  mode: ConversionMode = 'format',
  locale = 'en-US'
): string {
  if (escapedText != null) {
    return toLuxonLiteral(escapedText);
  }

  if (match === "'") {
    return toLuxonLiteral(match);
  }

  if (omitZoneName && (match === 'z' || match === 'zz')) {
    return '';
  }

  if (match === 'Do') {
    return `d'${ORDINAL_MARKER}'`;
  }

  if (match === 'L' || match === 'llll') {
    // Resolve llll fields first to preserve Intl's effective time padding and numeric month choices.
    const options =
      match === 'L'
        ? { year: 'numeric', month: '2-digit', day: '2-digit' }
        : new Intl.DateTimeFormat(locale, DateTime.DATETIME_MED_WITH_WEEKDAY).resolvedOptions();
    // Intl resolves valid format options, but its declarations widen field values to strings.
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const localizedFormat = DateTime.parseFormatForOpts(options as Intl.DateTimeFormatOptions, { locale });
    // Luxon generates a parser-only numeric-year token; adapt only this generated pattern,
    // not the user's tokens or escaped literals, so the same pattern also formats correctly.
    // Keep generated name tokens consistent with the shim's mappings so formatted names also parse.
    return (localizedFormat ?? TOKEN_MAP[match])
      .replace('yyyyy', 'yyyy')
      .replace('EEE', TOKEN_MAP.ddd)
      .replace('MMM', TOKEN_MAP.MMM);
  }

  return TOKEN_MAPS[mode][match] ?? match;
}

function toLuxonLiteral(literal: string): string {
  // An empty Luxon literal (`''`) emits one quote, so quoted sections must be split around quotes.
  return literal
    .split("'")
    .map((part) => (part ? `'${part}'` : ''))
    .join("''");
}

export function convertMomentToLuxonWithOrdinal(format: string, locale?: string): string {
  return convertFormat(format, false, 'format', locale).luxonFormat;
}

export function convertMomentToLuxonForParsing(format: string, locale?: string, padded = false): string {
  return convertFormat(format, false, padded ? 'paddedParse' : 'parse', locale)
    .luxonFormat.split(LOWER_MERIDIEM_FORMAT)
    .join('a');
}

function getOrdinal(day: number): string {
  const value = day % 100;
  return ORDINAL_SUFFIXES[(value - 20) % 10] ?? ORDINAL_SUFFIXES[value] ?? 'th';
}

export function formatWithOrdinal(luxonDateTime: DateTime, momentFormat: string): string {
  const { luxonFormat, hasOrdinal, hasMeridiem, hasOneToTwentyFourHour, hasWeekday } = convertFormat(
    momentFormat,
    luxonDateTime.zone.type === 'system',
    'format',
    luxonDateTime.locale ?? undefined
  );
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
    formatted = formatted.replace(LOWER_MERIDIEM_MARKER_PATTERN, (_: string, meridiem: string) =>
      meridiem.toLowerCase()
    );
  }

  if (hasOneToTwentyFourHour) {
    formatted = formatted.replace(ONE_TO_TWENTY_FOUR_HOUR_MARKER_PATTERN, (_: string, rawHour: string) =>
      Number(rawHour) === 0 ? '24' : rawHour
    );
  }

  if (hasWeekday) {
    formatted = formatted.replace(WEEKDAY_MARKER_PATTERN, (_: string, kind: string) =>
      kind === 'Number' ? String(luxonDateTime.weekday % 7) : (luxonDateTime.weekdayShort?.slice(0, 2) ?? '')
    );
  }

  return formatted;
}
