import { type DateTimeUnit, type DurationUnit, type TokenParser, DateTime, Duration, IANAZone, Settings } from 'luxon';

import { convertMomentToLuxonWithOrdinal, formatWithOrdinal } from './format';

export type MomentUnit =
  | 'years'
  | 'year'
  | 'y'
  | 'quarters'
  | 'quarter'
  | 'Q'
  | 'months'
  | 'month'
  | 'M'
  | 'weeks'
  | 'week'
  | 'isoWeek'
  | 'w'
  | 'days'
  | 'day'
  | 'd'
  | 'hours'
  | 'hour'
  | 'h'
  | 'minutes'
  | 'minute'
  | 'm'
  | 'seconds'
  | 'second'
  | 's'
  | 'milliseconds'
  | 'millisecond'
  | 'ms';

type StartEndUnit =
  | 'year'
  | 'month'
  | 'week'
  | 'isoWeek'
  | 'day'
  | 'date'
  | 'hour'
  | 'minute'
  | 'second'
  | 'quarter'
  | 'y'
  | 'M'
  | 'w'
  | 'd'
  | 'h'
  | 'm'
  | 's'
  | 'Q';

type InputObject = Partial<{
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
}>;

type InputArray = ReadonlyArray<string | number>;

export type MomentInput = MomentLike | DateTime | Date | number | string | InputObject | InputArray | undefined | null;
interface MomentBuiltinFormat {
  __momentBuiltinFormatBrand: unknown;
}
type MomentFormat = string | MomentBuiltinFormat;
type FormatArg = string | undefined;
type UnitGetter = MomentUnit | DateTimeUnit | 'date';

type MomentDurationInput = number | string | undefined | null;

interface MomentOptions {
  locale?: string;
  zone?: string;
}

interface ParseOptions {
  format?: MomentFormat;
}

export interface MomentTimeZoneInfo {
  name: string;
  abbr(timestamp: number): string;
  utcOffset(timestamp: number): number;
}

interface MomentTzFactory {
  (input?: MomentInput, zone?: string): MomentLike;
  (input?: MomentInput, format?: MomentFormat, zone?: string): MomentLike;
  guess(ignoreCache?: boolean): string;
  zone(name: string): MomentTimeZoneInfo | null;
  isValidZone(name: string): boolean;
}

// deliberately narrower than moment's real API: it only carries the methods Grafana's own code
// (and the public `DateTime`/`DateTimeDuration` interfaces in moment_wrapper.ts) actually use.

// getter when called with no argument, setter (mutating and returning the instance) when called
// with one, matching moment's own overloaded typings
interface UnitAccessor {
  (): number;
  (value: number): MomentLike;
}

export interface MomentLike {
  _isAMomentObject?: boolean;

  add(value: number, unit?: MomentUnit | string): MomentLike;
  subtract(value: number, unit?: MomentUnit | string): MomentLike;
  startOf(unit: StartEndUnit): MomentLike;
  endOf(unit: StartEndUnit): MomentLike;
  set(unit: UnitGetter, value: number): MomentLike;
  get(unit: UnitGetter): number;
  locale(value: string): MomentLike;
  utc(keepLocalTime?: boolean): MomentLike;
  local(): MomentLike;
  tz(): string | undefined;
  tz(zone: string, keepLocalTime?: boolean): MomentLike;
  clone(): MomentLike;
  year: UnitAccessor;
  years: UnitAccessor;
  month: UnitAccessor;
  months: UnitAccessor;
  date: UnitAccessor;
  dates: UnitAccessor;
  day: UnitAccessor;
  days: UnitAccessor;
  weekday: UnitAccessor;
  isoWeekday: UnitAccessor;
  week: UnitAccessor;
  weeks: UnitAccessor;
  isoWeek: UnitAccessor;
  isoWeeks: UnitAccessor;
  hour: UnitAccessor;
  hours: UnitAccessor;
  minute: UnitAccessor;
  minutes: UnitAccessor;
  second: UnitAccessor;
  seconds: UnitAccessor;
  millisecond: UnitAccessor;
  milliseconds: UnitAccessor;
  isValid(): boolean;
  isBefore(input: MomentInput, unit?: DateTimeUnit): boolean;
  isAfter(input: MomentInput, unit?: DateTimeUnit): boolean;
  isBetween(a: MomentInput, b: MomentInput, unit?: DateTimeUnit, inclusivity?: string): boolean;
  isSame(input: MomentInput, unit?: DateTimeUnit): boolean;
  diff(input: MomentInput, unit?: DurationUnit, asFloat?: boolean): number;
  toDate(): Date;
  toISOString(keepOffset?: boolean): string | null;
  toJSON(): string | null;
  toString(): string;
  valueOf(): number;
  unix(): number;
  toLocaleString(): string;
  utcOffset(): number;
  format(template?: FormatArg): string;
  fromNow(withoutSuffix?: boolean): string;
  toNow(withoutSuffix?: boolean): string;
  from(input: MomentInput, withoutSuffix?: boolean): string;
}

interface MomentDurationLike {
  asMilliseconds(): number;
  asSeconds(): number;
  asHours(): number;
  valueOf(): number;
  seconds(): number;
  minutes(): number;
  hours(): number;
}

const UNIT_MAP: Record<MomentUnit, DurationUnit> = {
  years: 'years',
  year: 'years',
  y: 'years',
  quarters: 'quarters',
  quarter: 'quarters',
  Q: 'quarters',
  months: 'months',
  month: 'months',
  M: 'months',
  weeks: 'weeks',
  week: 'weeks',
  isoWeek: 'weeks',
  w: 'weeks',
  days: 'days',
  day: 'days',
  d: 'days',
  hours: 'hours',
  hour: 'hours',
  h: 'hours',
  minutes: 'minutes',
  minute: 'minutes',
  m: 'minutes',
  seconds: 'seconds',
  second: 'seconds',
  s: 'seconds',
  milliseconds: 'milliseconds',
  millisecond: 'milliseconds',
  ms: 'milliseconds',
};

const START_END_UNIT_MAP: Record<StartEndUnit, DateTimeUnit> = {
  year: 'year',
  y: 'year',
  month: 'month',
  M: 'month',
  week: 'week',
  isoWeek: 'week',
  w: 'week',
  day: 'day',
  date: 'day',
  d: 'day',
  hour: 'hour',
  h: 'hour',
  minute: 'minute',
  m: 'minute',
  second: 'second',
  s: 'second',
  quarter: 'quarter',
  Q: 'quarter',
};

const DEFAULT_LOCALE = 'en';
// branding a runtime string as the moment-style sentinel requires an assertion; the brand only
// exists at the type level, and callers compare against this constant by identity.
// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
const ISO_8601 = 'ISO_8601' as unknown as MomentBuiltinFormat;

let currentLocale = DEFAULT_LOCALE;
Settings.defaultLocale = currentLocale;
const localeWeekStart: Record<string, number> = {};
const intlFormatterCache = new Map<string, Intl.DateTimeFormat>();
const zoneValidityCache = new Map<string, boolean>();
const normalizedLocaleCache = new Map<string, string | undefined>();
let cachedGuessedZone: string | null = null;

// memoized because this runs on every instance construction (the factories always pass the
// current locale) and Intl.getCanonicalLocales is not free. Keys only come from config/runtime
// locale strings, so the cache stays small for the lifetime of the page.
function normalizeLocale(locale?: string): string | undefined {
  if (locale == null) {
    return undefined;
  }

  if (normalizedLocaleCache.has(locale)) {
    return normalizedLocaleCache.get(locale);
  }

  const normalized = computeNormalizedLocale(locale);
  normalizedLocaleCache.set(locale, normalized);
  return normalized;
}

function computeNormalizedLocale(locale: string): string | undefined {
  const trimmed = locale.trim();
  if (trimmed === '') {
    return undefined;
  }

  // Common runtime locale formats (e.g. en_US.UTF-8, en_US@posix) are not always
  // valid BCP-47 tags and can throw in Intl.DateTimeFormat.
  const cleaned = trimmed.split('.')[0].split('@')[0].replace(/_/g, '-');
  const fallback = cleaned.split('-')[0];
  const candidates = [cleaned, fallback];

  for (const candidate of candidates) {
    if (candidate === '') {
      continue;
    }

    try {
      const [canonical] = Intl.getCanonicalLocales(candidate);
      if (canonical) {
        return canonical;
      }
    } catch {
      // Keep trying candidates.
    }
  }

  return DEFAULT_LOCALE;
}

function isInputObject(value: unknown): value is InputObject {
  if (value == null || typeof value !== 'object') {
    return false;
  }

  if (value instanceof Date || DateTime.isDateTime(value)) {
    return false;
  }

  return !Array.isArray(value);
}

// positional units of a moment array input: [year, month, day, hour, minute, second, millisecond]
const ARRAY_INPUT_UNITS = ['year', 'month', 'day', 'hour', 'minute', 'second', 'millisecond'] as const;

function normalizeArrayInput(input: InputArray, options?: MomentOptions): DateTime {
  if (input.length === 0) {
    return DateTime.now();
  }

  const values = input.slice(0, ARRAY_INPUT_UNITS.length).map(Number);

  if (values.some((v) => Number.isNaN(v))) {
    return DateTime.invalid('unsupported array input');
  }

  const normalized: InputObject = {};

  values.forEach((value, i) => {
    const unit = ARRAY_INPUT_UNITS[i];
    // moment array months are zero-based, luxon months are one-based.
    normalized[unit] = unit === 'month' ? value + 1 : value;
  });

  return DateTime.fromObject(normalized, options);
}

function getCachedDateTimeFormatter(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const normalizedLocale = normalizeLocale(locale) ?? DEFAULT_LOCALE;
  const key = `${normalizedLocale}|${JSON.stringify(options)}`;
  const cached = intlFormatterCache.get(key);
  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat(normalizedLocale, options);
  intlFormatterCache.set(key, formatter);
  return formatter;
}

function isMomentUnit(unit: string): unit is MomentUnit {
  return unit in UNIT_MAP;
}

function normalizeUnit(unit: string): DurationUnit {
  return isMomentUnit(unit) ? UNIT_MAP[unit] : 'milliseconds';
}

function normalizeStartEndUnit(unit: StartEndUnit): DateTimeUnit {
  return START_END_UNIT_MAP[unit];
}

function normalizeDurationInput(input: number, unit?: MomentUnit | string): Duration {
  if (unit == null) {
    return Duration.fromMillis(input);
  }

  return Duration.fromObject({ [normalizeUnit(unit)]: input });
}

const formatParserCache = new Map<string, TokenParser>();

// DateTime.fromFormat recompiles its token parser (including regex construction) on every call
// and parse formats are highly repetitive, so cache the compiled parser. The parser is
// locale-bound (fromFormatParser rejects a locale mismatch), so the locale is part of the key.
function parseFromCachedFormat(value: string, fmt: string, options?: MomentOptions): DateTime {
  const key = `${options?.locale ?? ''}|${fmt}`;
  let parser = formatParserCache.get(key);

  if (!parser) {
    parser = DateTime.buildFormatParser(fmt, { locale: options?.locale });
    formatParserCache.set(key, parser);
  }

  return DateTime.fromFormatParser(value, parser, options);
}

function parseWithFormat(value: string, format: MomentFormat, options?: MomentOptions): DateTime {
  if (format === ISO_8601) {
    return DateTime.fromISO(value, options);
  }

  // moment's unix timestamp tokens (X = seconds, x = millis) are output-only in luxon;
  // DateTime.fromFormat cannot parse them, so handle them numerically here.
  if (format === 'X' || format === 'x') {
    const num = Number(value);

    if (value.trim() === '' || Number.isNaN(num)) {
      return DateTime.invalid('unparsable unix timestamp');
    }

    return format === 'X' ? DateTime.fromSeconds(num, options) : DateTime.fromMillis(num, options);
  }

  // ISO_8601 is the only non-string MomentFormat member and it is handled above, so this
  // fallback never changes behavior; it only narrows the type for the format conversions below.
  const fmt = convertMomentToLuxonWithOrdinal(typeof format === 'string' ? format : 'ISO_8601');

  const parsed = parseFromCachedFormat(value, fmt, options);
  if (parsed.isValid) {
    return parsed;
  }

  // try to handle partial parse 'yyyy' from '2017-07-19 00:00:00.000'
  const fallbackParsed = parseWithFallbacks(value, options);
  if (fallbackParsed.isValid) {
    const formatted = fallbackParsed.toFormat(fmt, options);
    // re-parse with only the requested tokens; if that truncation loses validity, keep the full
    // fallback parse (the same result normalizeInput would otherwise recompute via its own
    // parseWithFallbacks pass)
    const reparsed = parseFromCachedFormat(formatted, fmt, options);
    return reparsed.isValid ? reparsed : fallbackParsed;
  }

  return DateTime.invalid('unsupported format input');
}

function parseWithFallbacks(value: string, options?: MomentOptions): DateTime {
  const parsers = [
    () => DateTime.fromISO(value, options),
    () => DateTime.fromRFC2822(value, options),
    () => DateTime.fromHTTP(value, options),
    () => DateTime.fromSQL(value, options),
    // like moment, fall back to js Date() parsing as a last resort. it accepts looser inputs than
    // the luxon parsers above, e.g. RFC 2822 strings missing their mandatory timezone (seen in
    // RSS pubDates), which it interprets in the environment's local zone.
    () => DateTime.fromJSDate(new Date(value), options),
  ];

  for (const parse of parsers) {
    const dt = parse();
    if (dt.isValid) {
      return dt;
    }
  }

  return DateTime.invalid('unsupported string input');
}

function stripRelativeAffixes(value: string): string {
  return value.replace(/^in\s+/, '').replace(/\s+ago$/, '');
}

function toRelativeString(
  target: DateTime,
  base: DateTime | undefined,
  locale: string | null,
  withoutSuffix: boolean
): string {
  const relative = target.toRelative({
    base,
    style: 'long',
    locale: locale ?? undefined,
    rounding: 'round',
  });

  if (!withoutSuffix || relative == null) {
    return relative ?? '';
  }

  return stripRelativeAffixes(relative);
}

function toMomentDay(weekday: number): number {
  return weekday % 7;
}

// canonical field for every get() unit spelling; get() dispatches to the matching accessor so the
// moment-vs-luxon offset semantics (0-based months, etc.) live in exactly one place. The 'day'
// family maps to day-of-month (luxon semantics, matching this shim's behavior to date), not
// moment's weekday.
const FIELD_BY_UNIT: Partial<
  Record<UnitGetter, 'year' | 'month' | 'date' | 'week' | 'hour' | 'minute' | 'second' | 'millisecond' | 'quarter'>
> = {
  millisecond: 'millisecond',
  milliseconds: 'millisecond',
  ms: 'millisecond',
  second: 'second',
  seconds: 'second',
  s: 'second',
  minute: 'minute',
  minutes: 'minute',
  m: 'minute',
  hour: 'hour',
  hours: 'hour',
  h: 'hour',
  day: 'date',
  days: 'date',
  d: 'date',
  date: 'date',
  week: 'week',
  weeks: 'week',
  w: 'week',
  month: 'month',
  months: 'month',
  M: 'month',
  year: 'year',
  years: 'year',
  y: 'year',
  quarter: 'quarter',
  quarters: 'quarter',
  Q: 'quarter',
};

function getLocaleFirstDayOfWeek(locale = currentLocale): number {
  return localeWeekStart[locale] ?? 0;
}

function createTimeZoneInfo(name: string): MomentTimeZoneInfo | null {
  const nowInZone = DateTime.now().setZone(name);
  if (!nowInZone.isValid) {
    return null;
  }

  return {
    name,
    abbr(timestamp: number) {
      const dt = DateTime.fromMillis(timestamp, { zone: name, locale: currentLocale });
      return dt.offsetNameShort ?? '';
    },
    utcOffset(timestamp: number) {
      const dt = DateTime.fromMillis(timestamp, { zone: name });
      // moment-timezone uses minutes west of UTC (Date#getTimezoneOffset style).
      return -dt.offset;
    },
  };
}

function normalizeInput(input: MomentInput, options?: MomentOptions, parseOptions?: ParseOptions): DateTime {
  const locale = normalizeLocale(options?.locale);

  if (typeof input === 'undefined') {
    return DateTime.now()
      .reconfigure({ locale })
      .setZone(options?.zone ?? 'local');
  }

  if (Array.isArray(input)) {
    return normalizeArrayInput(input, options);
  }

  if (isMomentLike(input)) {
    const sourceZone = input.tz();
    return DateTime.fromMillis(input.valueOf(), {
      zone: options?.zone ?? sourceZone,
      locale,
    });
  }

  if (DateTime.isDateTime(input)) {
    return input;
  }

  if (input instanceof Date) {
    const dateTime = DateTime.fromJSDate(input, { zone: options?.zone });
    return locale ? dateTime.setLocale(locale) : dateTime;
  }

  if (typeof input === 'number') {
    return DateTime.fromMillis(input, {
      ...options,
      locale,
    });
  }

  if (typeof input === 'string') {
    if (parseOptions?.format) {
      const formatted = parseWithFormat(input, parseOptions.format, {
        ...options,
        locale,
      });

      if (formatted.isValid) {
        return formatted;
      }
    }

    return parseWithFallbacks(input, {
      ...options,
      locale,
    });
  }

  if (isInputObject(input)) {
    // explicit annotation because luxon's `isDateTime` guard (`o is DateTime<true> | DateTime<false>`)
    // cannot subtract `DateTime<boolean>` from the union above, and a surviving `DateTime` is
    // structurally assignable to `InputObject`, so spreading it here would otherwise widen to `{}`.
    const normalized: InputObject = { ...input };
    if (normalized.month != null) {
      normalized.month += 1;
    }
    return DateTime.fromObject(normalized, {
      ...options,
      locale,
    });
  }

  return DateTime.invalid('unsupported moment input');
}

function isMomentLike(value: unknown): value is MomentLike {
  return (
    typeof value === 'object' &&
    value != null &&
    // @ts-ignore
    value._isAMomentObject
  );
}

function weekdayNames(locale: string): string[] {
  const dateFmt = getCachedDateTimeFormatter(locale, {
    weekday: 'long',
    timeZone: 'UTC',
  });

  return Array.from({ length: 7 }, (_, i) => dateFmt.format(new Date(Date.UTC(2020, 5, 7 + i))));
}

// millis of `dt` and `other`, truncated to `unit` when given, for comparisons
function comparableMillis(dt: DateTime, other: MomentInput, unit?: DateTimeUnit): [number, number] {
  const b = normalizeInput(other);

  if (unit) {
    return [dt.startOf(unit).toMillis(), b.startOf(unit).toMillis()];
  }

  return [dt.toMillis(), b.toMillis()];
}

function startOfLocaleWeek(dt: DateTime): DateTime {
  const weekStart = getLocaleFirstDayOfWeek(dt.locale || currentLocale);
  const currentDay = toMomentDay(dt.weekday);
  const daysSinceWeekStart = (currentDay - weekStart + 7) % 7;
  return dt.startOf('day').minus({ days: daysSinceWeekStart });
}

function endOfLocaleWeek(dt: DateTime): DateTime {
  return startOfLocaleWeek(dt).plus({ days: 6 }).endOf('day');
}

// a class with a shared prototype rather than a per-call object literal: instances are created on
// every formatted value in hot paths, and the literal version allocated ~60 closures per instance
// where the class allocates one object holding a single field. Real moment is also prototype-based,
// so instance shape (methods not own-enumerable) matches what callers saw before the migration.
class MomentCompat implements MomentLike {
  declare _isAMomentObject: boolean;

  // plural/synonym unit spellings share the canonical unit's prototype method (assigned below the
  // class): moment treats e.g. minutes() as minute(), and week()/isoWeek() as synonyms.
  declare years: UnitAccessor;
  declare months: UnitAccessor;
  declare dates: UnitAccessor;
  declare days: UnitAccessor;
  declare weekday: UnitAccessor;
  declare weeks: UnitAccessor;
  declare isoWeek: UnitAccessor;
  declare isoWeeks: UnitAccessor;
  declare hours: UnitAccessor;
  declare minutes: UnitAccessor;
  declare seconds: UnitAccessor;
  declare milliseconds: UnitAccessor;

  private _dt: DateTime;

  constructor(dt: DateTime) {
    this._dt = dt;
  }

  private _setDt(next: DateTime): MomentLike {
    this._dt = next;
    return this;
  }

  add(value: number, unit?: MomentUnit | string): MomentLike {
    return this._setDt(this._dt.plus(normalizeDurationInput(value, unit)));
  }

  subtract(value: number, unit?: MomentUnit | string): MomentLike {
    return this._setDt(this._dt.minus(normalizeDurationInput(value, unit)));
  }

  startOf(unit: StartEndUnit): MomentLike {
    if (unit === 'week' || unit === 'w') {
      return this._setDt(startOfLocaleWeek(this._dt));
    }

    return this._setDt(this._dt.startOf(normalizeStartEndUnit(unit)));
  }

  endOf(unit: StartEndUnit): MomentLike {
    if (unit === 'week' || unit === 'w') {
      return this._setDt(endOfLocaleWeek(this._dt));
    }

    return this._setDt(this._dt.endOf(normalizeStartEndUnit(unit)));
  }

  set(unit: UnitGetter, value: number): MomentLike {
    if (value == null) {
      return this;
    }

    if (unit === 'month' || unit === 'months' || unit === 'M') {
      return this._setDt(this._dt.set({ month: value + 1 }));
    }
    if (unit === 'date') {
      return this._setDt(this._dt.set({ day: value }));
    }

    return this._setDt(this._dt.set({ [normalizeUnit(unit)]: value }));
  }

  get(unit: UnitGetter): number {
    const field = FIELD_BY_UNIT[unit];

    if (field === undefined) {
      return Number.NaN;
    }

    // quarter has no moment-style accessor on the shim
    return field === 'quarter' ? this._dt.quarter : this[field]();
  }

  locale(value: string): MomentLike {
    return this._setDt(this._dt.setLocale(normalizeLocale(value) ?? DEFAULT_LOCALE));
  }

  utc(keepLocalTime = false): MomentLike {
    return this._setDt(this._dt.setZone('utc', { keepLocalTime }));
  }

  local(): MomentLike {
    return this._setDt(this._dt.setZone('local'));
  }

  tz(): string | undefined;
  tz(zone: string, keepLocalTime?: boolean): MomentLike;
  tz(zone?: string, keepLocalTime = false): string | undefined | MomentLike {
    if (zone == null) {
      return this._dt.zoneName ?? undefined;
    }

    return this._setDt(this._dt.setZone(zone, { keepLocalTime }));
  }

  clone(): MomentLike {
    return new MomentCompat(this._dt);
  }

  year(): number;
  year(value: number): MomentLike;
  year(value?: number): number | MomentLike {
    return value == null ? this._dt.year : this._setDt(this._dt.set({ year: value }));
  }

  // moment months are 0-based
  month(): number;
  month(value: number): MomentLike;
  month(value?: number): number | MomentLike {
    return value == null ? this._dt.month - 1 : this._setDt(this._dt.set({ month: value + 1 }));
  }

  date(): number;
  date(value: number): MomentLike;
  date(value?: number): number | MomentLike {
    return value == null ? this._dt.day : this._setDt(this._dt.set({ day: value }));
  }

  // moment days are 0-based starting on Sunday
  day(): number;
  day(value: number): MomentLike;
  day(value?: number): number | MomentLike {
    return value == null
      ? toMomentDay(this._dt.weekday)
      : this._setDt(this._dt.plus({ days: value - toMomentDay(this._dt.weekday) }));
  }

  isoWeekday(): number;
  isoWeekday(value: number): MomentLike;
  isoWeekday(value?: number): number | MomentLike {
    return value == null ? this._dt.weekday : this._setDt(this._dt.plus({ days: value - this._dt.weekday }));
  }

  week(): number;
  week(value: number): MomentLike;
  week(value?: number): number | MomentLike {
    return value == null
      ? this._dt.weekNumber
      : this._setDt(this._dt.plus({ weeks: value - this._dt.weekNumber }));
  }

  hour(): number;
  hour(value: number): MomentLike;
  hour(value?: number): number | MomentLike {
    return value == null ? this._dt.hour : this._setDt(this._dt.set({ hour: value }));
  }

  minute(): number;
  minute(value: number): MomentLike;
  minute(value?: number): number | MomentLike {
    return value == null ? this._dt.minute : this._setDt(this._dt.set({ minute: value }));
  }

  second(): number;
  second(value: number): MomentLike;
  second(value?: number): number | MomentLike {
    return value == null ? this._dt.second : this._setDt(this._dt.set({ second: value }));
  }

  millisecond(): number;
  millisecond(value: number): MomentLike;
  millisecond(value?: number): number | MomentLike {
    return value == null ? this._dt.millisecond : this._setDt(this._dt.set({ millisecond: value }));
  }

  isValid(): boolean {
    return this._dt.isValid;
  }

  isBefore(other: MomentInput, unit?: DateTimeUnit): boolean {
    const [a, b] = comparableMillis(this._dt, other, unit);
    return a < b;
  }

  isAfter(other: MomentInput, unit?: DateTimeUnit): boolean {
    const [a, b] = comparableMillis(this._dt, other, unit);
    return a > b;
  }

  // like moment, bounds are not reordered (a reversed range is simply never matched) and the
  // unit truncates the endpoints as well as this instant
  isBetween(a: MomentInput, b: MomentInput, unit?: DateTimeUnit, inclusivity = '()'): boolean {
    const [value, left] = comparableMillis(this._dt, a, unit);
    const [, right] = comparableMillis(this._dt, b, unit);

    const afterStart = inclusivity.startsWith('[') ? value >= left : value > left;
    const beforeEnd = inclusivity.endsWith(']') ? value <= right : value < right;

    return afterStart && beforeEnd;
  }

  isSame(other: MomentInput, unit?: DateTimeUnit): boolean {
    const [a, b] = comparableMillis(this._dt, other, unit);
    return a === b;
  }

  diff(other: MomentInput, unit: DurationUnit = 'milliseconds', asFloat = false): number {
    const b = normalizeInput(other);
    const value = this._dt.diff(b, unit).as(unit);
    // moment truncates toward zero (returning 0, never -0) unless asFloat is passed
    return asFloat ? value : Math.trunc(value) || 0;
  }

  toDate(): Date {
    return this._dt.toJSDate();
  }

  toISOString(keepOffset = false): string | null {
    return !keepOffset ? this._dt.toUTC().toISO() : this._dt.toISO();
  }

  toJSON(): string | null {
    return this._dt.toJSON();
  }

  toString(): string {
    if (!this._dt.isValid) {
      return 'Invalid date';
    }

    return this._dt.setLocale('en').toFormat("ccc MMM dd yyyy HH:mm:ss 'GMT'ZZZ");
  }

  valueOf(): number {
    return this._dt.toMillis();
  }

  unix(): number {
    return Math.floor(this._dt.toSeconds());
  }

  toLocaleString(): string {
    return this._dt.toLocaleString(DateTime.DATETIME_MED);
  }

  utcOffset(): number {
    return this._dt.offset;
  }

  format(template?: FormatArg): string {
    if (template == null) {
      return this._dt.toISO({ precision: 'second' }) ?? '';
    }
    return formatWithOrdinal(this._dt, template);
  }

  fromNow(withoutSuffix = false): string {
    return toRelativeString(this._dt, undefined, this._dt.locale, withoutSuffix);
  }

  toNow(withoutSuffix = false): string {
    return toRelativeString(DateTime.now(), this._dt, this._dt.locale, withoutSuffix);
  }

  from(input: MomentInput, withoutSuffix = false): string {
    return toRelativeString(this._dt, normalizeInput(input), this._dt.locale, withoutSuffix);
  }
}

MomentCompat.prototype._isAMomentObject = true;

const proto = MomentCompat.prototype;
proto.years = proto.year;
proto.months = proto.month;
proto.dates = proto.date;
proto.days = proto.day;
// moment's weekday() is locale-aware; the shim aliases it to Sunday-based day(), matching the
// behavior this shim has always had (see the migration notes)
proto.weekday = proto.day;
proto.weeks = proto.week;
proto.isoWeek = proto.week;
proto.isoWeeks = proto.week;
proto.hours = proto.hour;
proto.minutes = proto.minute;
proto.seconds = proto.second;
proto.milliseconds = proto.millisecond;

function makeMoment(input?: MomentInput, options?: MomentOptions, parseOptions?: ParseOptions): MomentLike {
  return new MomentCompat(normalizeInput(input, options, parseOptions));
}

function makeDuration(input?: MomentDurationInput, unit?: MomentUnit): MomentDurationLike {
  let duration: Duration;

  if (input == null) {
    duration = Duration.fromMillis(0);
  } else if (typeof input === 'string') {
    const parsed = Duration.fromISO(input);
    duration = parsed.isValid ? parsed : Duration.fromMillis(0);
  } else {
    duration = normalizeDurationInput(input, unit);
  }

  // moment's seconds()/minutes()/hours() return integer components (0-59, 0-59, 0-23 with the
  // remainder carried into days), unlike as(unit) which returns the fractional total
  const parts = duration.shiftTo('days', 'hours', 'minutes', 'seconds', 'milliseconds');

  return {
    asMilliseconds() {
      return duration.as('milliseconds');
    },

    asSeconds() {
      return duration.as('seconds');
    },

    asHours() {
      return duration.as('hours');
    },

    valueOf() {
      return duration.as('milliseconds');
    },

    seconds() {
      return parts.seconds;
    },

    minutes() {
      return parts.minutes;
    },

    hours() {
      return parts.hours;
    },
  };
}

interface MomentFactory {
  (input?: MomentInput, format?: MomentFormat): MomentLike;
  ISO_8601: typeof ISO_8601;
  utc(input?: MomentInput, format?: MomentFormat): MomentLike;
  duration(input?: MomentDurationInput, unit?: MomentUnit): MomentDurationLike;
  isMoment(input: unknown): input is MomentLike;
  locale(locale?: string): string;
  localeData(locale?: string): { firstDayOfWeek: () => number };
  updateLocale(locale: string, config: { parentLocale?: string; week?: { dow?: number } }): string;
  tz: MomentTzFactory;
  weekdays(locale?: string): string[];
}

// a single implementation with union-typed parameters satisfies every overload of the factory
// interfaces, so building the callable-with-properties shape via Object.assign needs no assertion.
const momentTz: MomentTzFactory = Object.assign(
  (input?: MomentInput, formatOrZone?: MomentFormat, zoneMaybe?: string): MomentLike => {
    if (zoneMaybe != null) {
      return makeMoment(input, { zone: zoneMaybe, locale: currentLocale }, { format: formatOrZone });
    }

    // per the 2-arg overload the second argument is a zone name; non-string formats only occur
    // in the 3-arg overload handled above.
    if (typeof formatOrZone === 'string') {
      return makeMoment(input, { zone: formatOrZone, locale: currentLocale });
    }

    return makeMoment(input, { locale: currentLocale });
  },
  {
    guess: (ignoreCache = false): string => {
      if (ignoreCache || cachedGuessedZone == null) {
        cachedGuessedZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      }

      return cachedGuessedZone;
    },

    zone: (name: string): MomentTimeZoneInfo | null => createTimeZoneInfo(name),

    // cached because callers use this as a per-format-call gate (see formatter.ts/parser.ts) and
    // luxon's IANAZone.isValidZone constructs a throwaway Intl.DateTimeFormat on every call
    isValidZone: (name: string): boolean => {
      let valid = zoneValidityCache.get(name);

      if (valid === undefined) {
        valid = IANAZone.isValidZone(name);
        zoneValidityCache.set(name, valid);
      }

      return valid;
    },
  }
);

const moment: MomentFactory = Object.assign(
  (input?: MomentInput, format?: MomentFormat): MomentLike => {
    return makeMoment(input, { locale: currentLocale }, { format });
  },
  {
    ISO_8601,

    tz: momentTz,

    locale: (locale?: string): string => {
      const normalizedLocale = normalizeLocale(locale);
      if (normalizedLocale != null) {
        currentLocale = normalizedLocale;
        Settings.defaultLocale = normalizedLocale;
      }
      return currentLocale;
    },

    localeData: (locale = currentLocale) => ({
      firstDayOfWeek: () => getLocaleFirstDayOfWeek(locale),
    }),

    updateLocale: (locale: string, config: { parentLocale?: string; week?: { dow?: number } }): string => {
      const parentLocale = config.parentLocale ?? locale;
      localeWeekStart[locale] = config.week?.dow ?? getLocaleFirstDayOfWeek(parentLocale);
      return locale;
    },

    utc: (input?: MomentInput, format?: MomentFormat): MomentLike => {
      // the trailing .utc() is load-bearing for raw luxon DateTime inputs, which normalizeInput
      // passes through with their own zone, ignoring options.zone
      return makeMoment(input, { zone: 'utc', locale: currentLocale }, { format }).utc();
    },

    duration: (input?: MomentDurationInput, unit?: MomentUnit): MomentDurationLike => makeDuration(input, unit),

    isMoment: (input: unknown): input is MomentLike => isMomentLike(input),

    weekdays: (locale = currentLocale): string[] => weekdayNames(locale),
  }
);

export default moment;
