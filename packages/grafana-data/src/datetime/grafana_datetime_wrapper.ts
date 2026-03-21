import { DateTime as LuxonDateTime, Duration as LuxonDuration, IANAZone, Info, Settings } from 'luxon';

import { TimeZone } from '../types/time';

const ISO_8601_TOKEN = 'ISO_8601';
let configuredWeekStart = 0;

export interface DateTimeBuiltinFormat {
  __momentBuiltinFormatBrand: any;
}

export const ISO_8601: DateTimeBuiltinFormat = ISO_8601_TOKEN as unknown as DateTimeBuiltinFormat;
export type DateTimeInput = Date | string | number | Array<string | number> | DateTime | null;
export type FormatInput = string | DateTimeBuiltinFormat | undefined;
export type DurationInput = string | number | DateTimeDuration;
export type DurationUnit =
  | 'year'
  | 'years'
  | 'y'
  | 'month'
  | 'months'
  | 'M'
  | 'week'
  | 'weeks'
  | 'isoWeek'
  | 'w'
  | 'day'
  | 'days'
  | 'd'
  | 'hour'
  | 'hours'
  | 'h'
  | 'minute'
  | 'minutes'
  | 'm'
  | 'second'
  | 'seconds'
  | 's'
  | 'millisecond'
  | 'milliseconds'
  | 'ms'
  | 'quarter'
  | 'quarters'
  | 'Q';

export interface DateTimeLocale {
  firstDayOfWeek: () => number;
}

export interface DateTimeDuration {
  asHours: () => number;
  hours: () => number;
  minutes: () => number;
  seconds: () => number;
  asSeconds: () => number;
}

export interface DateTime extends Object {
  add: (amount?: DateTimeInput, unit?: DurationUnit) => DateTime;
  clone: () => DateTime;
  set: (unit: DurationUnit | 'date', amount: DateTimeInput) => void;
  diff: (amount: DateTimeInput, unit?: DurationUnit, truncate?: boolean) => number;
  endOf: (unitOfTime: DurationUnit) => DateTime;
  format: (formatInput?: FormatInput) => string;
  fromNow: (withoutSuffix?: boolean) => string;
  from: (formaInput: DateTimeInput) => string;
  isSame: (input?: DateTimeInput, granularity?: DurationUnit) => boolean;
  isBefore: (input?: DateTimeInput) => boolean;
  isValid: () => boolean;
  local: () => DateTime;
  locale: (locale: string) => DateTime;
  startOf: (unitOfTime: DurationUnit) => DateTime;
  subtract: (amount?: DateTimeInput, unit?: DurationUnit) => DateTime;
  toDate: () => Date;
  toISOString: (keepOffset?: boolean) => string;
  isoWeekday: (day?: number | string) => number | string;
  valueOf: () => number;
  unix: () => number;
  utc: () => DateTime;
  utcOffset: () => number;
  hour?: () => number;
  minute?: () => number;
  month?: () => number;
  date?: () => number;
  year?: () => number;
  tz?: (timeZone?: string) => DateTime | string;
}

class GrafanaDuration implements DateTimeDuration {
  constructor(private readonly value: LuxonDuration) {}

  asHours = () => this.value.as('hours');
  hours = () => this.value.hours;
  minutes = () => this.value.minutes;
  seconds = () => this.value.seconds;
  asSeconds = () => this.value.as('seconds');
}

class GrafanaDateTime implements DateTime {
  constructor(private value: LuxonDateTime) {}

  clone = () => new GrafanaDateTime(this.value);

  add = (amount?: DateTimeInput, unit?: DurationUnit): DateTime => {
    this.value = this.value.plus(normalizeDuration(amount, unit));
    return this;
  };

  set = (unit: DurationUnit | 'date', amount: DateTimeInput): void => {
    const numeric = typeof amount === 'number' ? amount : Number(amount);
    if (!Number.isFinite(numeric)) {
      return;
    }

    switch (unit) {
      case 'date':
      case 'day':
      case 'days':
      case 'd':
        this.value = this.value.set({ day: numeric });
        return;
      case 'month':
      case 'months':
      case 'M':
        this.value = this.value.set({ month: numeric + 1 });
        return;
      case 'year':
      case 'years':
      case 'y':
        this.value = this.value.set({ year: numeric });
        return;
      case 'hour':
      case 'hours':
      case 'h':
        this.value = this.value.set({ hour: numeric });
        return;
      case 'minute':
      case 'minutes':
      case 'm':
        this.value = this.value.set({ minute: numeric });
        return;
      case 'second':
      case 'seconds':
      case 's':
        this.value = this.value.set({ second: numeric });
        return;
      case 'millisecond':
      case 'milliseconds':
      case 'ms':
        this.value = this.value.set({ millisecond: numeric });
        return;
      default:
        this.value = this.value.plus(normalizeDuration(numeric, unit));
    }
  };

  diff = (amount: DateTimeInput, unit: DurationUnit = 'milliseconds', truncate?: boolean): number => {
    const other = normalizeInput(amount, this.value.zoneName ?? undefined);
    const result = this.value.diff(other.value, normalizeDiffUnit(unit)).as(normalizeDiffUnit(unit));
    return truncate ? Math.trunc(result) : result;
  };

  endOf = (unitOfTime: DurationUnit): DateTime => {
    this.value = adjustToBoundary(this.value, unitOfTime, true);
    return this;
  };

  format = (formatInput?: FormatInput): string => {
    if (!this.value.isValid) {
      return 'Invalid date';
    }

    if (!formatInput) {
      return (
        this.value
          .toISO({
            includeOffset: true,
            suppressMilliseconds: true,
          })
          ?.replace(/\.\d{3}(?=(Z|[+-]\d{2}:\d{2})$)/, '') ?? 'Invalid date'
      );
    }

    const format = formatInput === ISO_8601 ? "yyyy-MM-dd'T'HH:mm:ss.SSSZZ" : String(formatInput);
    return formatWithMomentTokens(this.value, format);
  };

  fromNow = (withoutSuffix?: boolean) => formatRelative(this.value.toRelative(), withoutSuffix);

  from = (formaInput: DateTimeInput) => {
    const other = normalizeInput(formaInput, this.value.zoneName ?? undefined);
    return formatRelative(this.value.toRelative({ base: other.value }), false);
  };

  isSame = (input?: DateTimeInput, granularity?: DurationUnit): boolean => {
    if (!input) {
      return false;
    }

    const other = normalizeInput(input, this.value.zoneName ?? undefined);
    if (!granularity) {
      return this.value.toMillis() === other.value.toMillis();
    }

    return adjustToBoundary(this.value, granularity, false).toMillis() === adjustToBoundary(other.value, granularity, false).toMillis();
  };

  isBefore = (input?: DateTimeInput): boolean => {
    if (!input) {
      return false;
    }
    return this.value.toMillis() < normalizeInput(input, this.value.zoneName ?? undefined).value.toMillis();
  };

  isValid = () => this.value.isValid;

  local = (): DateTime => {
    this.value = this.value.setZone(getBrowserTimeZone());
    return this;
  };

  locale = (locale: string): DateTime => {
    this.value = this.value.setLocale(locale);
    return this;
  };

  startOf = (unitOfTime: DurationUnit): DateTime => {
    this.value = adjustToBoundary(this.value, unitOfTime, false);
    return this;
  };

  subtract = (amount?: DateTimeInput, unit?: DurationUnit): DateTime => {
    this.value = this.value.minus(normalizeDuration(amount, unit));
    return this;
  };

  toDate = () => this.value.toJSDate();

  toISOString = (keepOffset?: boolean) =>
    (keepOffset ? this.value : this.value.toUTC()).toISO({
      includeOffset: true,
      suppressMilliseconds: false,
    }) ?? this.value.toString();

  isoWeekday = (day?: number | string): number | string => {
    if (day === undefined) {
      return this.value.weekday;
    }

    const numeric = typeof day === 'number' ? day : getWeekdayIndexByEnglishName(day) + 1;
    if (numeric > 0) {
      const current = this.value.weekday;
      this.value = this.value.plus({ days: numeric - current });
    }
    return this.value.weekday;
  };

  valueOf = () => this.value.toMillis();
  unix = () => Math.floor(this.value.toSeconds());

  utc = (): DateTime => {
    this.value = this.value.setZone('utc');
    return this;
  };

  utcOffset = () => this.value.offset;

  hour = () => this.value.hour;
  minute = () => this.value.minute;
  month = () => this.value.month - 1;
  date = () => this.value.day;
  year = () => this.value.year;

  tz = (timeZone?: string): string | DateTime => {
    if (!timeZone) {
      return this.value.zoneName ?? 'UTC';
    }

    this.value = this.value.setZone(timeZone);
    return this;
  };
}

export const setLocale = (language: string) => {
  Settings.defaultLocale = language;
  configuredWeekStart = getLocaleWeekStart(language);
};

export const getLocale = () => {
  return Settings.defaultLocale ?? Intl.DateTimeFormat().resolvedOptions().locale ?? 'en-US';
};

export const getLocaleData = (): DateTimeLocale => {
  return {
    firstDayOfWeek: () => configuredWeekStart,
  };
};

export const isDateTimeInput = (value: unknown): value is DateTimeInput => {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    value instanceof Date ||
    (Array.isArray(value) && value.every((v) => typeof v === 'string' || typeof v === 'number')) ||
    isDateTime(value)
  );
};

export const isDateTime = (value: unknown): value is DateTime => {
  return value instanceof GrafanaDateTime;
};

export const toUtc = (input?: DateTimeInput, formatInput?: FormatInput): DateTime => {
  return normalizeInput(input, 'utc', formatInput);
};

export const toDuration = (input?: DurationInput, unit?: DurationUnit): DateTimeDuration => {
  if (input instanceof GrafanaDuration) {
    return input;
  }

  if (typeof input === 'string') {
    return new GrafanaDuration(LuxonDuration.fromISOTime(input));
  }

  if (typeof input === 'number') {
    return new GrafanaDuration(LuxonDuration.fromMillis(convertToMilliseconds(input, unit)));
  }

  return new GrafanaDuration(LuxonDuration.fromMillis(0));
};

export const dateTime = (input?: DateTimeInput, formatInput?: FormatInput): DateTime => {
  return normalizeInput(input, undefined, formatInput);
};

export const dateTimeForTimeZone = (
  timezone?: TimeZone,
  input?: DateTimeInput,
  formatInput?: FormatInput
): DateTime => {
  if (timezone && timezone !== 'browser') {
    return normalizeInput(input, timezone, formatInput);
  }

  return dateTime(input, formatInput);
};

export const getWeekdayIndex = (day: string) => {
  return getLocalizedWeekdays().findIndex((wd) => wd.toLowerCase() === day.toLowerCase());
};

export const getWeekdayIndexByEnglishName = (day: string) =>
  ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].findIndex(
    (wd) => wd.toLowerCase() === day.toLowerCase()
  );

export const setWeekStart = (weekStart?: string) => {
  const dow = weekStart ? getWeekdayIndexByEnglishName(weekStart) : -1;
  configuredWeekStart = dow !== -1 ? dow : getLocaleWeekStart(getLocale());
};

const normalizeInput = (input?: DateTimeInput, zone?: string | null, formatInput?: FormatInput): GrafanaDateTime => {
  if (input instanceof GrafanaDateTime) {
    return input.clone() as GrafanaDateTime;
  }

  const normalizedZone = normalizeZone(zone ?? undefined);
  const locale = getLocale();
  const opts = normalizedZone ? { zone: normalizedZone, locale } : { locale };
  let value: LuxonDateTime;

  if (input === undefined) {
    value = normalizedZone ? LuxonDateTime.now().setZone(normalizedZone) : LuxonDateTime.now();
    return new GrafanaDateTime(value.setLocale(locale));
  }

  if (input === null) {
    return new GrafanaDateTime(LuxonDateTime.invalid('Invalid date'));
  }

  if (typeof input === 'string') {
    value = parseStringInput(input, formatInput, normalizedZone, locale);
    return new GrafanaDateTime(value);
  }

  if (typeof input === 'number') {
    value = LuxonDateTime.fromMillis(input, opts);
    return new GrafanaDateTime(value);
  }

  if (input instanceof Date) {
    value = LuxonDateTime.fromJSDate(input, opts);
    return new GrafanaDateTime(value);
  }

  if (Array.isArray(input)) {
    const [year, month = 0, day = 1, hour = 0, minute = 0, second = 0, millisecond = 0] = input.map(Number);
    value = LuxonDateTime.fromObject(
      { year, month: month + 1, day, hour, minute, second, millisecond },
      opts
    );
    return new GrafanaDateTime(value);
  }

  return new GrafanaDateTime(LuxonDateTime.invalid('Unsupported input'));
};

const parseStringInput = (input: string, formatInput: FormatInput, zone: string | undefined, locale: string) => {
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

const parseFormatPrefix = (input: string, format: string, zone: string | undefined, locale: string) => {
  const prefix = input.match(buildFormatPrefixRegex(format))?.[0];
  if (!prefix) {
    return undefined;
  }

  return LuxonDateTime.fromFormat(prefix, format, {
    zone: zone ?? undefined,
    locale,
    setZone: Boolean(zone),
  });
};

const buildFormatPrefixRegex = (format: string) => {
  const tokenPatterns: Array<[string, string]> = [
    ['yyyy', '\\d{4}'],
    ['yy', '\\d{2}'],
    ['LLLL', '[\\p{L}.]+'],
    ['LLL', '[\\p{L}.]+'],
    ['LL', '\\d{2}'],
    ['L', '\\d{1,2}'],
    ['cccc', '[\\p{L}.]+'],
    ['ccc', '[\\p{L}.]+'],
    ['cc', '[\\p{L}]{2}'],
    ['ooo', '\\d{3}'],
    ['o', '\\d{1,3}'],
    ['dd', '\\d{2}'],
    ['d', '\\d{1,2}'],
    ['HH', '\\d{2}'],
    ['H', '\\d{1,2}'],
    ['hh', '\\d{2}'],
    ['h', '\\d{1,2}'],
    ['mm', '\\d{2}'],
    ['m', '\\d{1,2}'],
    ['ss', '\\d{2}'],
    ['s', '\\d{1,2}'],
    ['SSS', '\\d{3}'],
    ['ZZ', '(?:Z|[+-]\\d{2}:?\\d{2})'],
    ['a', '[\\p{L}.]+'],
    ['q', '\\d'],
  ];

  let pattern = '^';
  for (let i = 0; i < format.length; ) {
    if (format[i] === "'") {
      let literal = '';
      i++;
      while (i < format.length) {
        if (format[i] === "'" && format[i + 1] === "'") {
          literal += "'";
          i += 2;
          continue;
        }
        if (format[i] === "'") {
          i++;
          break;
        }
        literal += format[i++];
      }
      pattern += escapeRegExp(literal);
      continue;
    }

    let matched = false;
    for (const [token, tokenPattern] of tokenPatterns) {
      if (format.slice(i, i + token.length) === token) {
        pattern += tokenPattern;
        i += token.length;
        matched = true;
        break;
      }
    }

    if (matched) {
      continue;
    }

    pattern += escapeRegExp(format[i]);
    i++;
  }

  return new RegExp(pattern, 'u');
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeZone = (zone?: string) => {
  if (!zone || zone === 'browser') {
    return undefined;
  }

  if (zone === 'utc') {
    return 'utc';
  }

  return IANAZone.isValidZone(zone) ? zone : undefined;
};

const getBrowserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';

const getLocaleWeekStart = (locale: string): number => {
  try {
    const firstDay = (new Intl.Locale(locale) as Intl.Locale & { weekInfo?: { firstDay?: number } }).weekInfo?.firstDay;
    return firstDay ? firstDay % 7 : 0;
  } catch {
    return 0;
  }
};

const getLocalizedWeekdays = () => {
  try {
    const locale = getLocale();
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(Date.UTC(2023, 0, 1 + index));
      return new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(date);
    });
  } catch {
    return Info.weekdays('long').map((weekday, index) => {
      const sundayFirstIndex = (index + 1) % 7;
      return Info.weekdays('long')[(sundayFirstIndex + 6) % 7];
    });
  }
};

const normalizeDuration = (amount?: DateTimeInput, unit?: DurationUnit) => {
  if (typeof amount !== 'number') {
    return {};
  }

  const normalizedUnit = normalizeDiffUnit(unit ?? 'milliseconds');
  return { [normalizedUnit]: amount };
};

const normalizeDiffUnit = (unit: DurationUnit) => {
  switch (unit) {
    case 'y':
    case 'year':
    case 'years':
      return 'years';
    case 'M':
    case 'month':
    case 'months':
      return 'months';
    case 'Q':
    case 'quarter':
    case 'quarters':
      return 'quarters';
    case 'w':
    case 'week':
    case 'weeks':
    case 'isoWeek':
      return 'weeks';
    case 'd':
    case 'day':
    case 'days':
      return 'days';
    case 'h':
    case 'hour':
    case 'hours':
      return 'hours';
    case 'm':
    case 'minute':
    case 'minutes':
      return 'minutes';
    case 's':
    case 'second':
    case 'seconds':
      return 'seconds';
    default:
      return 'milliseconds';
  }
};

const adjustToBoundary = (value: LuxonDateTime, unit: DurationUnit, roundUp: boolean) => {
  if (unit === 'w' || unit === 'week' || unit === 'weeks') {
    return boundaryForWeek(value, configuredWeekStart, roundUp);
  }

  if (unit === 'isoWeek') {
    return boundaryForWeek(value, 1, roundUp);
  }

  const normalizedUnit = normalizeDiffUnit(unit);
  if (normalizedUnit === 'quarters') {
    const quarterStartMonth = Math.floor((value.month - 1) / 3) * 3 + 1;
    const quarterStart = value.set({ month: quarterStartMonth, day: 1 }).startOf('day');
    return roundUp ? quarterStart.plus({ months: 2 }).endOf('month') : quarterStart;
  }

  const singularUnit = normalizedUnit.endsWith('s') ? normalizedUnit.slice(0, -1) : normalizedUnit;
  const normalized = value.startOf(singularUnit as 'year');
  return roundUp ? normalized.endOf(singularUnit as 'year') : normalized;
};

const boundaryForWeek = (value: LuxonDateTime, weekStart: number, roundUp: boolean) => {
  const dayOfWeek = value.weekday % 7;
  const diff = (dayOfWeek - weekStart + 7) % 7;
  const start = value.startOf('day').minus({ days: diff });
  return roundUp ? start.plus({ days: 6 }).endOf('day') : start;
};

const convertToMilliseconds = (value: number, unit?: DurationUnit) => {
  switch (normalizeDiffUnit(unit ?? 'milliseconds')) {
    case 'seconds':
      return value * 1000;
    case 'minutes':
      return value * 60 * 1000;
    case 'hours':
      return value * 60 * 60 * 1000;
    case 'days':
      return value * 24 * 60 * 60 * 1000;
    case 'weeks':
      return value * 7 * 24 * 60 * 60 * 1000;
    case 'months':
      return value * 30 * 24 * 60 * 60 * 1000;
    case 'years':
      return value * 365 * 24 * 60 * 60 * 1000;
    default:
      return value;
  }
};

const inputHasZone = (value: string) => /(?:Z|[+-]\d{2}(?::?\d{2})?)$/.test(value);

const formatRelative = (value: string | null, withoutSuffix?: boolean) => {
  if (!value) {
    return 'Invalid date';
  }

  if (!withoutSuffix) {
    return value;
  }

  return value.replace(/^in /, '').replace(/ ago$/, '');
};

const formatWithMomentTokens = (value: LuxonDateTime, format: string) => {
  const zonePlaceholder = '¤0¤';
  const lowerMeridiemPlaceholder = '¤1¤';
  const upperMeridiemPlaceholder = '¤2¤';
  const luxonFormat = toLuxonFormat(injectFormatPlaceholders(format, zonePlaceholder, lowerMeridiemPlaceholder, upperMeridiemPlaceholder));

  const meridiem = value.toFormat('a');
  return value
    .toFormat(luxonFormat)
    .replace(new RegExp(lowerMeridiemPlaceholder, 'g'), meridiem.toLowerCase())
    .replace(new RegExp(upperMeridiemPlaceholder, 'g'), meridiem.toUpperCase())
    .replace(new RegExp(zonePlaceholder, 'g'), getTimeZoneAbbreviation(value));
};

const getTimeZoneAbbreviation = (value: LuxonDateTime) => {
  const zoneName = value.zoneName ?? 'UTC';
  const date = value.toJSDate();

  try {
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

// Luxon ref: https://moment.github.io/luxon/#/formatting?id=table-of-tokens
// Moment ref: https://momentjs.com/docs/#/displaying/format/
const tokenMap: Array<[string, string]> = [
  ['YYYY', 'yyyy'],
  ['YY', 'yy'],
  ['MMMM', 'LLLL'],
  ['MMM', 'LLL'],
  ['MM', 'LL'],
  ['M', 'L'],
  ['DDDD', 'ooo'],
  ['DDD', 'o'],
  ['DD', 'dd'],
  ['D', 'd'],
  ['dddd', 'cccc'],
  ['ddd', 'ccc'],
  ['dd', 'cc'],
  ['A', 'a'],
  ['a', 'a'],
  ['HH', 'HH'],
  ['H', 'H'],
  ['hh', 'hh'],
  ['h', 'h'],
  ['mm', 'mm'],
  ['m', 'm'],
  ['ss', 'ss'],
  ['s', 's'],
  ['SSS', 'SSS'],
  ['Q', 'q'],
  ['ZZ', 'ZZ'],
  ['Z', 'ZZ'],
];

const toLuxonFormat = (format: string) => {
  let output = '';
  for (let i = 0; i < format.length; ) {
    const escaped = format[i] === '\\' && i + 1 < format.length;
    if (escaped) {
      output += `'${format[i + 1].replace(/'/g, "''")}'`;
      i += 2;
      continue;
    }

    let matched = false;
    for (const [momentToken, luxonToken] of tokenMap) {
      if (format.slice(i, i + momentToken.length) === momentToken) {
        output += luxonToken;
        i += momentToken.length;
        matched = true;
        break;
      }
    }

    if (matched) {
      continue;
    }

    const char = format[i];
    output += /[A-Za-z_]/.test(char) ? `'${char.replace(/'/g, "''")}'` : char;
    i++;
  }

  return output;
};

configuredWeekStart = getLocaleWeekStart(getLocale());
