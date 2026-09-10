import { canonicalZoneName, findTimeZoneAt } from '../easytz_lookup';

import { convertMomentToLuxonForParsing, formatWithOrdinal } from './format';
import {
  type DateTimeUnit,
  type DurationUnit,
  type TokenParser,
  type ZoneOffsetOptions,
  DateTime,
  Duration,
  FixedOffsetZone,
  IANAZone,
  Info,
  Settings,
  type WeekdayNumbers,
  type Zone,
} from './luxon';

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

type ArithmeticUnit = MomentUnit;
type DiffUnit = Exclude<MomentUnit, 'isoWeek'>;
type StartEndUnit = MomentUnit | 'isoWeeks' | 'W' | 'date' | 'dates' | 'D' | undefined;
type Inclusivity = '()' | '[)' | '(]' | '[]';

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
type UnitGetter = Exclude<StartEndUnit, undefined> | 'weekday' | 'weekdays' | 'e' | 'isoWeekday' | 'isoWeekdays' | 'E';

export type MomentDurationInputObject = Partial<Record<ArithmeticUnit, number | string>>;
type MomentDurationInput =
  | number
  | string
  | MomentDurationInputObject
  | Pick<MomentDurationLike, 'asMilliseconds'>
  | undefined
  | null;

interface MomentLocaleConfig {
  parentLocale?: string;
  week?: { dow?: number };
}

interface MomentOptions {
  locale?: string;
  zone?: string | Zone;
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

  add(value?: MomentDurationInput, unit?: ArithmeticUnit): MomentLike;
  subtract(value?: MomentDurationInput, unit?: ArithmeticUnit): MomentLike;
  startOf(unit: StartEndUnit): MomentLike;
  endOf(unit: StartEndUnit): MomentLike;
  set(unit: UnitGetter, value: number): MomentLike;
  get(unit: UnitGetter): number;
  locale(): string;
  locale(value: string): MomentLike;
  utc(keepLocalTime?: boolean): MomentLike;
  local(keepLocalTime?: boolean): MomentLike;
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
  isBefore(input?: MomentInput, unit?: StartEndUnit): boolean;
  isAfter(input?: MomentInput, unit?: StartEndUnit): boolean;
  isBetween(a: MomentInput, b: MomentInput, unit?: StartEndUnit, inclusivity?: Inclusivity): boolean;
  isSame(input?: MomentInput, unit?: StartEndUnit): boolean;
  diff(input: MomentInput, unit?: DiffUnit, asFloat?: boolean): number;
  toDate(): Date;
  toISOString(keepOffset?: boolean): string | null;
  toJSON(): string | null;
  toString(): string;
  valueOf(): number;
  unix(): number;
  toLocaleString(): string;
  utcOffset(): number;
  utcOffset(value: number | string, keepLocalTime?: boolean): MomentLike;
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

const START_END_UNIT_MAP: Record<Exclude<StartEndUnit, undefined>, DateTimeUnit> = {
  years: 'year',
  year: 'year',
  y: 'year',
  quarters: 'quarter',
  quarter: 'quarter',
  Q: 'quarter',
  months: 'month',
  month: 'month',
  M: 'month',
  weeks: 'week',
  week: 'week',
  isoWeek: 'week',
  isoWeeks: 'week',
  W: 'week',
  w: 'week',
  days: 'day',
  day: 'day',
  date: 'day',
  dates: 'day',
  D: 'day',
  d: 'day',
  hours: 'hour',
  hour: 'hour',
  h: 'hour',
  minutes: 'minute',
  minute: 'minute',
  m: 'minute',
  seconds: 'second',
  second: 'second',
  s: 'second',
  milliseconds: 'millisecond',
  millisecond: 'millisecond',
  ms: 'millisecond',
};

const DEFAULT_LOCALE = 'en';
// branding a runtime string as the moment-style sentinel requires an assertion; the brand only
// exists at the type level, and callers compare against this constant by identity.
// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
const ISO_8601 = 'ISO_8601' as unknown as MomentBuiltinFormat;

let currentLocale = DEFAULT_LOCALE;
Settings.defaultLocale = currentLocale;
const localeOverrides = new Map<string, { locale: string; dow: number }>();
const intlFormatterCache = new Map<string, Intl.DateTimeFormat>();
const timeZoneInfoCache = new Map<string, MomentTimeZoneInfo | null>();
const normalizedLocaleCache = new Map<string, string | undefined>();
let cachedGuessedZone: string | null = null;

// memoized because this runs on every instance construction (the factories always pass the
// current locale) and Intl.getCanonicalLocales is not free. Keys only come from config/runtime
// locale strings, so the cache stays small for the lifetime of the page.
function normalizeLocale(locale?: string): string | undefined {
  if (locale == null) {
    return undefined;
  }

  const override = localeOverrides.get(locale);
  if (override) {
    return override.locale;
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
  const values = input.slice(0, ARRAY_INPUT_UNITS.length).map(Number);

  if (values.some((v) => Number.isNaN(v))) {
    return DateTime.invalid('unsupported array input');
  }

  const normalized: InputObject = {};

  values.forEach((value, i) => {
    const unit = ARRAY_INPUT_UNITS[i];
    // moment array months are zero-based, luxon months are one-based.
    normalized[unit] = unit === 'month' ? value + 1 : unit === 'millisecond' ? Math.trunc(value) : value;
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
  return Object.prototype.hasOwnProperty.call(UNIT_MAP, unit);
}

function normalizeUnit(unit: string): DurationUnit {
  return isMomentUnit(unit) ? UNIT_MAP[unit] : 'milliseconds';
}

function normalizeStartEndUnit(unit: StartEndUnit): DateTimeUnit | undefined {
  return unit != null && Object.prototype.hasOwnProperty.call(START_END_UNIT_MAP, unit)
    ? START_END_UNIT_MAP[unit]
    : undefined;
}

const SHORTHAND_DURATION = /(\d+(?:\.\d*)?|\.\d+)(ms|s|m|h|d|w|M|y)/y;

function durationFromFields(fields: Partial<Record<DurationUnit, number>>): Duration {
  return Object.values(fields).every(Number.isFinite)
    ? Duration.fromObject(fields)
    : Duration.invalid('nonfinite duration');
}

function parseShorthandDuration(input: string): Duration | undefined {
  const value = input.trim();
  const sign = value[0] === '-' ? -1 : 1;
  let offset = value[0] === '-' || value[0] === '+' ? 1 : 0;
  if (offset === value.length) {
    return undefined;
  }

  const fields: Partial<Record<DurationUnit, number>> = {};
  while (offset < value.length) {
    // Sticky matching rejects gaps and trailing text instead of accepting a valid prefix.
    SHORTHAND_DURATION.lastIndex = offset;
    const part = SHORTHAND_DURATION.exec(value);
    if (!part || !isMomentUnit(part[2])) {
      return undefined;
    }
    const unit = UNIT_MAP[part[2]];
    fields[unit] = (fields[unit] ?? 0) + sign * Number(part[1]);
    offset = SHORTHAND_DURATION.lastIndex;
  }

  return durationFromFields(fields);
}

function normalizeDurationInput(input?: MomentDurationInput, unit?: ArithmeticUnit): Duration {
  if (input == null) {
    return Duration.fromMillis(0);
  }

  if (typeof input === 'object') {
    if ('asMilliseconds' in input) {
      // Preserve elapsed-millisecond arithmetic for duration instances, not their component methods.
      return normalizeDurationInput(input.asMilliseconds());
    }

    const fields: Partial<Record<DurationUnit, number>> = {};
    for (const key of Object.keys(input)) {
      if (isMomentUnit(key)) {
        // Object aliases overwrite in property order; unlike shorthand, they do not accumulate.
        fields[UNIT_MAP[key]] = Number(input[key] ?? 0);
      }
    }
    return durationFromFields(fields);
  }

  if (typeof input === 'string' && Number.isNaN(Number(input))) {
    const shorthand = parseShorthandDuration(input);
    if (shorthand) {
      return shorthand;
    }
    const parsed = Duration.fromISO(input);
    return parsed.isValid ? parsed : Duration.fromMillis(0);
  }

  const amount = Number(input);
  if (!Number.isFinite(amount)) {
    return Duration.invalid('nonfinite duration');
  }
  if (unit != null && !isMomentUnit(unit)) {
    return Duration.fromMillis(0);
  }
  return Duration.fromObject({ [unit == null ? 'milliseconds' : UNIT_MAP[unit]]: amount });
}

function arithmeticDuration(duration: Duration): Duration {
  // Calendar fractions round after aggregation; elapsed hours must not become calendar days.
  const months = duration.years * 12 + duration.quarters * 3 + duration.months;
  const days = duration.weeks * 7 + duration.days;
  return Duration.fromObject({
    months: Math.sign(months) * Math.round(Math.abs(months)),
    days: Math.sign(days) * Math.round(Math.abs(days)),
    milliseconds: duration.hours * 3600000 + duration.minutes * 60000 + duration.seconds * 1000 + duration.milliseconds,
  });
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

  return resolveParsedZone(DateTime.fromFormatParser(value, parser, { ...options, setZone: true }), options);
}

function preferEarlierOffset(dt: DateTime): DateTime {
  return dt
    .getPossibleOffsets()
    .reduce((earlier, candidate) => (candidate.toMillis() < earlier.toMillis() ? candidate : earlier), dt);
}

function resolveParsedZone(dt: DateTime, options?: MomentOptions): DateTime {
  // Parse with setZone first: explicit offsets stay fixed and must not be reinterpreted as ambiguous wall times.
  return preferEarlierOffset(dt).setZone(options?.zone ?? Settings.defaultZone);
}

function parseWithFormat(value: string, format: MomentFormat, options?: MomentOptions): DateTime {
  if (format === ISO_8601) {
    return resolveParsedZone(DateTime.fromISO(value, { ...options, setZone: true }), options);
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
  const fmt = convertMomentToLuxonForParsing(typeof format === 'string' ? format : 'ISO_8601', options?.locale);

  const parsed = parseFromCachedFormat(value, fmt, options);
  if (parsed.isValid || parsed.invalidReason !== 'unparsable') {
    return parsed;
  }

  if (typeof format === 'string') {
    const permissiveInputs: Array<[string, string]> = [];
    const abbreviatedMonthFormat = format.replaceAll('MMMM', 'MMM');
    const valueWithoutCommas = value.replaceAll(',', '');
    const formatWithoutCommas = format.replaceAll(',', '');

    if (abbreviatedMonthFormat !== format) {
      permissiveInputs.push([value, abbreviatedMonthFormat]);
    }
    if (valueWithoutCommas !== value || formatWithoutCommas !== format) {
      permissiveInputs.push([valueWithoutCommas, formatWithoutCommas]);
      if (abbreviatedMonthFormat !== format) {
        permissiveInputs.push([valueWithoutCommas, formatWithoutCommas.replaceAll('MMMM', 'MMM')]);
      }
    }

    for (const [permissiveValue, permissiveFormat] of permissiveInputs) {
      const permissiveParsed = parseFromCachedFormat(
        permissiveValue,
        convertMomentToLuxonForParsing(permissiveFormat, options?.locale),
        options
      );
      if (permissiveParsed.isValid || permissiveParsed.invalidReason !== 'unparsable') {
        return permissiveParsed;
      }
    }
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

  return fallbackParsed;
}

function parseWithFallbacks(value: string, options?: MomentOptions): DateTime {
  const parsers = [
    () => parseWithFormat(value, ISO_8601, options),
    () => DateTime.fromRFC2822(value, options),
    () => DateTime.fromHTTP(value, options),
    () => resolveParsedZone(DateTime.fromSQL(value, { ...options, setZone: true }), options),
    // like moment, fall back to js Date() parsing as a last resort. it accepts looser inputs than
    // the luxon parsers above, e.g. RFC 2822 strings missing their mandatory timezone (seen in
    // RSS pubDates), which it interprets in the environment's local zone.
    () => DateTime.fromJSDate(new Date(value), options),
  ];

  for (const parse of parsers) {
    const dt = parse();
    if (dt.isValid || dt.invalidReason !== 'unparsable') {
      return dt;
    }
  }

  return DateTime.invalid('unparsable');
}

type RelativeUnit = 'years' | 'months' | 'days' | 'hours' | 'minutes' | 'seconds';

const RELATIVE_UNITS: RelativeUnit[] = ['years', 'months', 'days', 'hours', 'minutes', 'seconds'];
const RELATIVE_UNIT_FLOORS: Partial<Record<RelativeUnit, number>> = {
  years: 365 * 86400000 - 26 * 3600000,
  months: 28 * 86400000 - 26 * 3600000,
  hours: 3600000,
  minutes: 60000,
  seconds: 1000,
};

function relativeDurationToHuman(value: number, unit: RelativeUnit, locale: string | null): string {
  return Duration.fromObject({ [unit]: value }, { locale: locale ?? undefined })
    .toHuman()
    .replace(/[\u00a0\u202f]/g, ' ');
}

function toRelativeWithoutSuffix(target: DateTime, base: DateTime, locale: string | null): string {
  const spread = Math.abs(target.toMillis() - base.toMillis());

  for (const unit of RELATIVE_UNITS) {
    const floor = RELATIVE_UNIT_FLOORS[unit];
    if (floor != null && spread < floor) {
      continue;
    }

    const count = target.diff(base, unit).get(unit);
    if (Math.abs(count) >= 1) {
      return relativeDurationToHuman(Math.abs(Math.round(count)), unit, locale);
    }
  }

  return relativeDurationToHuman(0, 'seconds', locale);
}

function toRelativeString(
  target: DateTime,
  base: DateTime | undefined,
  locale: string | null,
  withoutSuffix: boolean
): string {
  if (!target.isValid || (base != null && !base.isValid)) {
    return 'Invalid date';
  }

  const relativeBase = base ?? DateTime.now().setZone(target.zone);
  if (withoutSuffix) {
    return toRelativeWithoutSuffix(target, relativeBase, locale);
  }

  const relative = target.toRelative({
    base: relativeBase,
    style: 'long',
    locale: locale ?? undefined,
    rounding: 'round',
  });

  return relative ?? 'Invalid date';
}

function toMomentDay(weekday: number): number {
  return weekday % 7;
}

// Constructor objects use day-of-month; get/set use Moment's weekday semantics instead.
const FIELD_BY_UNIT: Partial<
  Record<
    UnitGetter,
    | 'year'
    | 'month'
    | 'date'
    | 'day'
    | 'weekday'
    | 'isoWeekday'
    | 'week'
    | 'isoWeek'
    | 'hour'
    | 'minute'
    | 'second'
    | 'millisecond'
    | 'quarter'
  >
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
  day: 'day',
  days: 'day',
  d: 'day',
  date: 'date',
  dates: 'date',
  D: 'date',
  weekday: 'weekday',
  weekdays: 'weekday',
  e: 'weekday',
  isoWeekday: 'isoWeekday',
  isoWeekdays: 'isoWeekday',
  E: 'isoWeekday',
  isoWeek: 'isoWeek',
  isoWeeks: 'isoWeek',
  W: 'isoWeek',
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
  return localeOverrides.get(locale)?.dow ?? Info.getStartOfWeek({ locale: normalizeLocale(locale) }) % 7;
}

function isWeekdayNumber(value: number): value is WeekdayNumbers {
  return Number.isInteger(value) && value >= 1 && value <= 7;
}

function getLocaleWeekNumber(dt: DateTime, locale: string): number {
  const dow = localeOverrides.get(locale)?.dow;
  if (dow == null) {
    return dt.localWeekNumber;
  }
  const firstDay = dow || 7;
  if (!isWeekdayNumber(firstDay)) {
    return NaN;
  }
  return dt.reconfigure({
    weekSettings: {
      firstDay,
      minimalDays: Info.getMinimumDaysInFirstWeek({ locale: dt.locale ?? undefined }),
      weekend: [6, 7],
    },
  }).localWeekNumber;
}

function normalizeZoneName(name: string): string {
  return name.toLowerCase() === 'utc' ? 'UTC' : canonicalZoneName(name);
}

const easyTzZoneCache = new Map<string, IANAZone>();

class EasyTzZone extends IANAZone {
  override offsetName(timestamp: number, options: ZoneOffsetOptions) {
    if (options.format === 'short') {
      const abbreviation = findTimeZoneAt(this.name, timestamp)?.abbr;
      if (abbreviation) {
        return abbreviation;
      }
    }
    return super.offsetName(timestamp, options);
  }

  override offset(timestamp: number): number {
    return findTimeZoneAt(this.name, timestamp)?.offset ?? super.offset(timestamp);
  }
}

function normalizeZone(zone: string | Zone): Zone {
  if (typeof zone !== 'string') {
    return zone;
  }

  const name = normalizeZoneName(zone);
  if (name === 'UTC') {
    return FixedOffsetZone.instance(0);
  }

  let normalized = easyTzZoneCache.get(name);

  if (!normalized) {
    normalized = new EasyTzZone(name);
    easyTzZoneCache.set(name, normalized);
  }
  return normalized;
}

function createTimeZoneInfo(name: string): MomentTimeZoneInfo | null {
  if (timeZoneInfoCache.has(name)) {
    return timeZoneInfoCache.get(name) ?? null;
  }

  const normalizedName = normalizeZoneName(name);
  if (!IANAZone.isValidZone(normalizedName)) {
    timeZoneInfoCache.set(name, null);
    return null;
  }

  const zone = {
    name: normalizedName,
    abbr(timestamp: number) {
      return (
        findTimeZoneAt(normalizedName, timestamp)?.abbr ??
        DateTime.fromMillis(timestamp, { zone: normalizedName, locale: currentLocale }).offsetNameShort ??
        ''
      );
    },
    utcOffset(timestamp: number) {
      const info = findTimeZoneAt(normalizedName, timestamp);
      // moment-timezone uses minutes west of UTC (Date#getTimezoneOffset style).
      return -(info?.offset ?? DateTime.fromMillis(timestamp, { zone: normalizedName }).offset);
    },
  };
  timeZoneInfoCache.set(name, zone);
  timeZoneInfoCache.set(normalizedName, zone);
  return zone;
}

function parseInput(input: MomentInput, options?: MomentOptions, parseOptions?: ParseOptions): DateTime {
  const locale = normalizeLocale(options?.locale);

  if (typeof input === 'undefined' || (Array.isArray(input) && input.length === 0)) {
    return DateTime.now()
      .reconfigure({ locale })
      .setZone(options?.zone ?? 'local');
  }

  if (Array.isArray(input)) {
    return preferEarlierOffset(normalizeArrayInput(input, { ...options, locale }));
  }

  if (isMomentLike(input)) {
    const sourceZone = input.tz();
    return DateTime.fromMillis(input.valueOf(), {
      zone: options?.zone ?? (sourceZone ? normalizeZone(sourceZone) : undefined),
      locale,
    });
  }

  if (DateTime.isDateTime(input)) {
    return options?.zone ? input.setZone(options.zone) : input;
  }

  if (input instanceof Date) {
    const dateTime = DateTime.fromJSDate(input, { zone: options?.zone });
    return locale ? dateTime.setLocale(locale) : dateTime;
  }

  if (typeof input === 'number') {
    if (!Number.isFinite(input)) {
      return DateTime.invalid('nonfinite timestamp');
    }
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

      if (formatted.isValid || parseOptions.format === ISO_8601 || formatted.invalidReason !== 'unparsable') {
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
    if (normalized.millisecond != null) {
      normalized.millisecond = Math.trunc(normalized.millisecond);
    }
    return preferEarlierOffset(DateTime.fromObject(normalized, { ...options, locale }));
  }

  return DateTime.invalid('unsupported moment input');
}

function normalizeInput(input: MomentInput, options?: MomentOptions, parseOptions?: ParseOptions): DateTime {
  return truncateToWholeMilliseconds(parseInput(input, options, parseOptions));
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

function unitBoundary(dt: DateTime, unit: StartEndUnit, locale: string, end = false): DateTime {
  const normalizedUnit = normalizeStartEndUnit(unit);
  if (normalizedUnit == null) {
    return dt;
  }
  if (unit === 'week' || unit === 'weeks' || unit === 'w') {
    const start = startOfLocaleWeek(dt, locale);
    return end ? start.plus({ days: 6 }).endOf('day') : start;
  }
  return end ? dt.endOf(normalizedUnit) : dt.startOf(normalizedUnit);
}

function startOfLocaleWeek(dt: DateTime, locale: string): DateTime {
  const weekStart = getLocaleFirstDayOfWeek(locale);
  const currentDay = toMomentDay(dt.weekday);
  const daysSinceWeekStart = (currentDay - weekStart + 7) % 7;
  return dt.startOf('day').minus({ days: daysSinceWeekStart });
}

function truncateToWholeMilliseconds(dt: DateTime): DateTime {
  const milliseconds = dt.toMillis();
  if (!Number.isFinite(milliseconds) || Number.isInteger(milliseconds)) {
    return dt;
  }

  return DateTime.fromMillis(Math.trunc(milliseconds), {
    zone: dt.zone,
    locale: dt.locale ?? undefined,
  });
}

// a class with a shared prototype rather than a per-call object literal: instances are created on
// every formatted value in hot paths, and the literal version allocated ~60 closures per instance
// where the class allocates one object holding a single field. Real moment is also prototype-based,
// so instance shape (methods not own-enumerable) matches what callers saw before the migration.
class MomentCompat implements MomentLike {
  declare _isAMomentObject: boolean;

  // Plural accessors share the canonical prototype methods without per-instance allocations.
  declare years: UnitAccessor;
  declare months: UnitAccessor;
  declare dates: UnitAccessor;
  declare days: UnitAccessor;
  declare weeks: UnitAccessor;
  declare isoWeeks: UnitAccessor;
  declare hours: UnitAccessor;
  declare minutes: UnitAccessor;
  declare seconds: UnitAccessor;
  declare milliseconds: UnitAccessor;

  private _dt: DateTime;
  private _locale: string;

  constructor(dt: DateTime, locale = dt.locale ?? DEFAULT_LOCALE) {
    this._dt = dt;
    this._locale = locale;
  }

  private _setDt(next: DateTime): MomentLike {
    this._dt = truncateToWholeMilliseconds(next);
    return this;
  }

  add(value?: MomentDurationInput, unit?: ArithmeticUnit): MomentLike {
    const duration = normalizeDurationInput(value, unit);
    return this._setDt(
      duration.isValid ? this._dt.plus(arithmeticDuration(duration)) : DateTime.invalid('invalid duration')
    );
  }

  subtract(value?: MomentDurationInput, unit?: ArithmeticUnit): MomentLike {
    const duration = normalizeDurationInput(value, unit);
    return this._setDt(
      duration.isValid ? this._dt.minus(arithmeticDuration(duration)) : DateTime.invalid('invalid duration')
    );
  }

  startOf(unit: StartEndUnit): MomentLike {
    return this._setDt(unitBoundary(this._dt, unit, this._locale));
  }

  endOf(unit: StartEndUnit): MomentLike {
    return this._setDt(unitBoundary(this._dt, unit, this._locale, true));
  }

  set(unit: UnitGetter, value: number): MomentLike {
    if (value == null) {
      return this;
    }

    const field = Object.prototype.hasOwnProperty.call(FIELD_BY_UNIT, unit) ? FIELD_BY_UNIT[unit] : undefined;
    if (field == null) {
      return this;
    }
    return field === 'quarter' ? this.month((value - 1) * 3 + (this.month() % 3)) : this[field](value);
  }

  get(unit: UnitGetter): number {
    const field = Object.prototype.hasOwnProperty.call(FIELD_BY_UNIT, unit) ? FIELD_BY_UNIT[unit] : undefined;

    if (field === undefined) {
      return Number.NaN;
    }

    // quarter has no moment-style accessor on the shim
    return field === 'quarter' ? this._dt.quarter : this[field]();
  }

  locale(): string;
  locale(value: string): MomentLike;
  locale(value?: string): string | MomentLike {
    if (value == null) {
      return this._locale;
    }
    this._locale = localeOverrides.has(value) ? value : (normalizeLocale(value) ?? DEFAULT_LOCALE);
    return this._setDt(this._dt.setLocale(normalizeLocale(value) ?? DEFAULT_LOCALE));
  }

  utc(keepLocalTime = false): MomentLike {
    return this._setDt(this._dt.setZone('utc', { keepLocalTime }));
  }

  local(keepLocalTime = false): MomentLike {
    return this._setDt(this._dt.setZone('local', { keepLocalTime }));
  }

  tz(): string | undefined;
  tz(zone: string, keepLocalTime?: boolean): MomentLike;
  tz(zone?: string, keepLocalTime = false): string | undefined | MomentLike {
    if (zone == null) {
      return this._dt.zoneName ?? undefined;
    }

    return this._setDt(this._dt.setZone(normalizeZone(zone), { keepLocalTime }));
  }

  clone(): MomentLike {
    return new MomentCompat(this._dt, this._locale);
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

  weekday(): number;
  weekday(value: number): MomentLike;
  weekday(value?: number): number | MomentLike {
    const day = (this.day() - getLocaleFirstDayOfWeek(this._locale) + 7) % 7;
    return value == null ? day : this._setDt(this._dt.plus({ days: value - day }));
  }

  isoWeekday(): number;
  isoWeekday(value: number): MomentLike;
  isoWeekday(value?: number): number | MomentLike {
    return value == null ? this._dt.weekday : this._setDt(this._dt.plus({ days: value - this._dt.weekday }));
  }

  week(): number;
  week(value: number): MomentLike;
  week(value?: number): number | MomentLike {
    const week = getLocaleWeekNumber(this._dt, this._locale);
    return value == null ? week : this._setDt(this._dt.plus({ weeks: value - week }));
  }

  isoWeek(): number;
  isoWeek(value: number): MomentLike;
  isoWeek(value?: number): number | MomentLike {
    return value == null ? this._dt.weekNumber : this._setDt(this._dt.plus({ weeks: value - this._dt.weekNumber }));
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

  isBefore(other?: MomentInput, unit?: StartEndUnit): boolean {
    return unitBoundary(this._dt, unit, this._locale, true).toMillis() < normalizeInput(other).toMillis();
  }

  isAfter(other?: MomentInput, unit?: StartEndUnit): boolean {
    return unitBoundary(this._dt, unit, this._locale).toMillis() > normalizeInput(other).toMillis();
  }

  isBetween(a: MomentInput, b: MomentInput, unit?: StartEndUnit, inclusivity: Inclusivity = '()'): boolean {
    const left = normalizeInput(a);
    const right = normalizeInput(b);
    if (!this.isValid() || !left.isValid || !right.isValid) {
      return false;
    }
    return (
      (inclusivity[0] === '[' ? !this.isBefore(left, unit) : this.isAfter(left, unit)) &&
      (inclusivity[1] === ']' ? !this.isAfter(right, unit) : this.isBefore(right, unit))
    );
  }

  isSame(other?: MomentInput, unit?: StartEndUnit): boolean {
    const value = normalizeInput(other).toMillis();
    return (
      unitBoundary(this._dt, unit, this._locale).toMillis() <= value &&
      value <= unitBoundary(this._dt, unit, this._locale, true).toMillis()
    );
  }

  diff(other: MomentInput, unit: DiffUnit = 'milliseconds', asFloat = false): number {
    const b = normalizeInput(other);
    const normalizedUnit = normalizeUnit(unit);
    const value = this._dt.diff(b, normalizedUnit).as(normalizedUnit);
    // moment truncates toward zero (returning 0, never -0) unless asFloat is passed
    return asFloat ? value : Math.trunc(value) + 0;
  }

  toDate(): Date {
    return this._dt.toJSDate();
  }

  toISOString(keepOffset = false): string | null {
    return !keepOffset ? this._dt.toUTC().toISO() : this._dt.toISO();
  }

  toJSON(): string | null {
    return this.toISOString();
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

  utcOffset(): number;
  utcOffset(value: number | string, keepLocalTime?: boolean): MomentLike;
  utcOffset(value?: number | string, keepLocalTime = false): number | MomentLike {
    if (value == null) {
      return this._dt.offset;
    }

    let zone: FixedOffsetZone | null;
    if (typeof value === 'string') {
      const offset = value.match(/Z|[+-]\d\d(?::?\d\d)?/gi)?.at(-1);
      if (!offset) {
        return this;
      }
      zone = FixedOffsetZone.parseSpecifier(
        offset.toUpperCase() === 'Z' ? 'UTC' : `UTC${offset.replace(/([+-]\d{2})(\d{2})$/, '$1:$2')}`
      );
    } else {
      zone = FixedOffsetZone.instance(Math.abs(value) < 16 ? value * 60 : value);
    }

    return zone ? this._setDt(this._dt.setZone(zone, { keepLocalTime })) : this;
  }

  format(template?: FormatArg): string {
    if (!this._dt.isValid) {
      return 'Invalid date';
    }

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

proto.weeks = proto.week;
proto.isoWeeks = proto.isoWeek;
proto.hours = proto.hour;
proto.minutes = proto.minute;
proto.seconds = proto.second;
proto.milliseconds = proto.millisecond;

function makeMoment(input?: MomentInput, options?: MomentOptions, parseOptions?: ParseOptions): MomentLike {
  // Custom valueOf implementations retain the generic Moment-like conversion behavior.
  if (input instanceof MomentCompat && input.valueOf === MomentCompat.prototype.valueOf) {
    const copy = input.clone();
    return options?.zone ? copy.tz(typeof options.zone === 'string' ? options.zone : options.zone.name) : copy;
  }
  const normalizedOptions = options?.zone ? { ...options, zone: normalizeZone(options.zone) } : options;
  const dt = normalizeInput(input, normalizedOptions, parseOptions);
  const locale = DateTime.isDateTime(input)
    ? (input.locale ?? DEFAULT_LOCALE)
    : options?.locale && localeOverrides.has(options.locale)
      ? options.locale
      : (dt.locale ?? DEFAULT_LOCALE);
  return new MomentCompat(dt, locale);
}

function makeDuration(input?: MomentDurationInput, unit?: ArithmeticUnit): MomentDurationLike {
  const duration = normalizeDurationInput(input, unit);

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

export interface MomentFactory {
  (input?: MomentInput, format?: MomentFormat): MomentLike;
  ISO_8601: typeof ISO_8601;
  utc(input?: MomentInput, format?: MomentFormat): MomentLike;
  duration(input?: MomentDurationInput, unit?: ArithmeticUnit): MomentDurationLike;
  isMoment(input: unknown): input is MomentLike;
  locale(locale?: string): string;
  localeData(locale?: string): { firstDayOfWeek: () => number };
  updateLocale(locale: string, config: MomentLocaleConfig): string;
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

    return typeof input === 'string'
      ? makeMoment(undefined, { zone: input, locale: currentLocale })
      : makeMoment(input, { locale: currentLocale });
  },
  {
    guess: (ignoreCache = false): string => {
      if (ignoreCache || cachedGuessedZone == null) {
        cachedGuessedZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      }

      return cachedGuessedZone;
    },

    zone: (name: string): MomentTimeZoneInfo | null => createTimeZoneInfo(name),
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
        currentLocale = locale != null && localeOverrides.has(locale) ? locale : normalizedLocale;
        Settings.defaultLocale = normalizedLocale;
      }
      return currentLocale;
    },

    localeData: (locale = currentLocale) => ({
      firstDayOfWeek: () => getLocaleFirstDayOfWeek(locale),
    }),

    updateLocale: (locale: string, config: MomentLocaleConfig): string => {
      const parentLocale = config.parentLocale ?? locale;
      localeOverrides.set(locale, {
        locale: normalizeLocale(parentLocale) ?? DEFAULT_LOCALE,
        dow: config.week?.dow ?? getLocaleFirstDayOfWeek(parentLocale),
      });
      return moment.locale(locale);
    },

    utc: (input?: MomentInput, format?: MomentFormat): MomentLike => {
      return makeMoment(input, { zone: 'utc', locale: currentLocale }, { format });
    },

    duration: (input?: MomentDurationInput, unit?: ArithmeticUnit): MomentDurationLike => makeDuration(input, unit),

    isMoment: (input: unknown): input is MomentLike => isMomentLike(input),

    weekdays: (locale = currentLocale): string[] => weekdayNames(locale),
  }
);

export default moment;
