import { type DateTimeUnit, type DurationLikeObject, type DurationUnit, DateTime, Duration } from 'luxon';

import { convertMomentToLuxonWithOrdinal, formatWithOrdinal } from './format';

type MomentUnit =
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

type StartEndUnit = 'year' | 'month' | 'week' | 'isoWeek' | 'day' | 'date' | 'hour' | 'minute' | 'second' | 'quarter';

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
type MomentFormat = string | string[];
type FormatArg = string | undefined;
type UnitGetter = MomentUnit | DateTimeUnit | 'date' | 's' | 'm' | 'h' | 'd' | 'M' | 'y' | 'w';

type LocaleUnit = 'long' | 'short' | 'narrow';
type DiffUnit = DurationUnit | DurationUnit[];

type MomentDurationInput =
  | MomentDurationLike
  | number
  | string
  | Partial<Record<MomentUnit | DurationUnit, number>>
  | undefined
  | null;

interface MomentOptions {
  locale?: string;
  zone?: string;
}

interface ParseOptions {
  format?: MomentFormat;
  strict?: boolean;
}

interface MomentTimeZoneInfo {
  name: string;
  abbr(timestamp: number): string;
  utcOffset(timestamp: number): number;
}

interface MomentTzFactory {
  (input?: MomentInput, zone?: string): MomentLike;
  (input?: MomentInput, format?: string, zone?: string): MomentLike;
  guess(ignoreCache?: boolean): string;
  zone(name: string): MomentTimeZoneInfo | null;
  names(): string[];
}

export interface MomentLike {
  add(value: number | MomentDurationLike | string, unit?: MomentUnit | string): MomentLike;
  subtract(value: number | MomentDurationLike | string, unit?: MomentUnit | string): MomentLike;
  startOf(unit: StartEndUnit): MomentLike;
  endOf(unit: StartEndUnit): MomentLike;
  set(values: InputObject): MomentLike;
  set(unit: UnitGetter, value: number): MomentLike;
  get(unit: UnitGetter): number;
  locale(value: string): MomentLike;
  utc(keepLocalTime?: boolean): MomentLike;
  local(): MomentLike;
  tz(zone: string, keepLocalTime?: boolean): MomentLike;
  clone(): MomentLike;
  year(value?: number): number | MomentLike;
  month(value?: number): number | MomentLike;
  date(value?: number): number | MomentLike;
  day(value?: number): number | MomentLike;
  weekday(value?: number): number | MomentLike;
  isoWeekday(value?: number): number | MomentLike;
  week(value?: number): number | MomentLike;
  isoWeek(value?: number): number | MomentLike;
  hour(value?: number): number | MomentLike;
  minute(value?: number): number | MomentLike;
  second(value?: number): number | MomentLike;
  millisecond(value?: number): number | MomentLike;
  isValid(): boolean;
  isBefore(input: MomentInput, unit?: DateTimeUnit): boolean;
  isAfter(input: MomentInput, unit?: DateTimeUnit): boolean;
  isSame(input: MomentInput, unit?: DateTimeUnit): boolean;
  diff(input: MomentInput, unit?: DiffUnit): number;
  toDate(): Date;
  toISOString(): string | null;
  toJSON(): string | null;
  toString(): string;
  valueOf(): number;
  unix(): number;
  toLocaleString(): string;
  utcOffset(): number;
  format(template?: FormatArg): string;
  fromNow(withoutSuffix?: boolean): string | null;
  toNow(withoutSuffix?: boolean): string | null;
  from(input: MomentInput, withoutSuffix?: boolean): string | null;
}

export interface MomentDurationLike {
  add(value: number | MomentDurationLike, unit?: MomentUnit): MomentDurationLike;
  subtract(value: number | MomentDurationLike, unit?: MomentUnit): MomentDurationLike;
  as(unit: DurationUnit): number;
  asMilliseconds(): number;
  asSeconds(): number;
  asHours(): number;
  humanize(withSuffix?: boolean): string;
  clone(): MomentDurationLike;
  valueOf(): number;
  milliseconds(): number;
  seconds(): number;
  minutes(): number;
  hours(): number;
  days(): number;
  weeks(): number;
  months(): number;
  years(): number;
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
  month: 'month',
  week: 'week',
  isoWeek: 'week',
  day: 'day',
  date: 'day',
  hour: 'hour',
  minute: 'minute',
  second: 'second',
  quarter: 'quarter',
};

const DEFAULT_LOCALE = 'en';
const DEFAULT_MOMENT_FORMAT = 'YYYY-MM-DDTHH:mm:ssZ';
const ISO_8601 = 'ISO_8601';

let currentLocale = DEFAULT_LOCALE;
const localeWeekStart: Record<string, number> = {};
const intlFormatterCache = new Map<string, Intl.DateTimeFormat>();
let cachedGuessedZone: string | null = null;
let cachedTimeZones: string[] | null = null;

function isInputObject(value: unknown): value is InputObject {
  if (value == null || typeof value !== 'object') {
    return false;
  }

  if (value instanceof Date || DateTime.isDateTime(value)) {
    return false;
  }

  return !Array.isArray(value);
}

function normalizeArrayInput(input: InputArray, options?: MomentOptions): DateTime {
  if (input.length === 0) {
    return DateTime.now();
  }

  const toUnitNumber = (value: string | number): number => Number(value);
  const [rawYear, rawMonth, rawDay, rawHour, rawMinute, rawSecond, rawMillisecond] = input.map(toUnitNumber);

  if (
    [rawYear, rawMonth, rawDay, rawHour, rawMinute, rawSecond, rawMillisecond].some((v) => v != null && Number.isNaN(v))
  ) {
    return DateTime.invalid('unsupported array input');
  }

  const normalized: InputObject = {};

  if (rawYear != null) {
    normalized.year = rawYear;
  }
  if (rawMonth != null) {
    // moment array months are zero-based, luxon months are one-based.
    normalized.month = rawMonth + 1;
  }
  if (rawDay != null) {
    normalized.day = rawDay;
  }
  if (rawHour != null) {
    normalized.hour = rawHour;
  }
  if (rawMinute != null) {
    normalized.minute = rawMinute;
  }
  if (rawSecond != null) {
    normalized.second = rawSecond;
  }
  if (rawMillisecond != null) {
    normalized.millisecond = rawMillisecond;
  }

  return DateTime.fromObject(normalized, options);
}

function getCachedDateTimeFormatter(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  const cached = intlFormatterCache.get(key);
  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat(locale, options);
  intlFormatterCache.set(key, formatter);
  return formatter;
}

function getSupportedTimeZones(): string[] {
  if (cachedTimeZones != null) {
    return cachedTimeZones;
  }

  cachedTimeZones = Intl.supportedValuesOf('timeZone');

  return cachedTimeZones;
}

function normalizeUnit(unit: MomentUnit): DurationUnit {
  return UNIT_MAP[unit] ?? 'milliseconds';
}

function normalizeStartEndUnit(unit: StartEndUnit): DateTimeUnit {
  return START_END_UNIT_MAP[unit] ?? 'day';
}

function normalizeDiffUnit(unit?: DiffUnit): DurationUnit {
  if (Array.isArray(unit)) {
    return unit[0] ?? 'milliseconds';
  }

  return unit ?? 'milliseconds';
}

function parseClockDuration(value: string, format?: string): Duration | null {
  if (format !== 'HH:mm' && format !== 'HH:mm:ss') {
    return null;
  }

  const parts = value.split(':').map((v) => Number(v));
  if (parts.some((v) => Number.isNaN(v))) {
    return null;
  }

  const [hours = 0, minutes = 0, seconds = 0] = parts;
  return Duration.fromObject({ hours, minutes, seconds });
}

function normalizeDurationInput(input: number | MomentDurationLike | string, unit?: MomentUnit | string): Duration {
  if (typeof input === 'string') {
    const parsedClock = parseClockDuration(input, unit);
    if (parsedClock) {
      return parsedClock;
    }
  }

  if (typeof input === 'number') {
    if (unit == null) {
      return Duration.fromMillis(input);
    }

    const normalizedUnit = normalizeUnit(unit as MomentUnit);
    return Duration.fromObject({ [normalizedUnit]: input });
  }

  if (typeof input === 'string') {
    return Duration.fromMillis(0);
  }

  return Duration.fromMillis(input.valueOf());
}

function parseWithFormats(value: string, format: MomentFormat, options?: MomentOptions): DateTime {
  const formats = Array.isArray(format) ? format : [format];

  for (let fmt of formats) {
    const parsed =
      fmt === ISO_8601
        ? DateTime.fromISO(value, options)
        : DateTime.fromFormat(value, convertMomentToLuxonWithOrdinal(fmt), options);
    if (parsed.isValid) {
      return parsed;
    }
  }

  return DateTime.invalid('unsupported format input');
}

function parseWithFallbacks(value: string, options?: MomentOptions): DateTime {
  const parsers = [
    () => DateTime.fromISO(value, options),
    () => DateTime.fromRFC2822(value, options),
    () => DateTime.fromHTTP(value, options),
    () => DateTime.fromSQL(value, options),
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

function toMomentDay(weekday: number): number {
  return weekday % 7;
}

function getFieldByUnit(dt: DateTime, unit: UnitGetter): number {
  switch (unit) {
    case 'millisecond':
    case 'milliseconds':
    case 'ms':
      return dt.millisecond;
    case 'second':
    case 'seconds':
    case 's':
      return dt.second;
    case 'minute':
    case 'minutes':
    case 'm':
      return dt.minute;
    case 'hour':
    case 'hours':
    case 'h':
      return dt.hour;
    case 'day':
    case 'days':
    case 'd':
    case 'date':
      return dt.day;
    case 'week':
    case 'weeks':
    case 'w':
      return dt.weekNumber;
    case 'month':
    case 'months':
    case 'M':
      return dt.month - 1;
    case 'year':
    case 'years':
    case 'y':
      return dt.year;
    case 'quarter':
    case 'quarters':
    case 'Q':
      return dt.quarter;
    default:
      return Number.NaN;
  }
}

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
      const dt = DateTime.fromMillis(timestamp, { zone: name });
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
  if (input == null) {
    return DateTime.now();
  }

  if (Array.isArray(input)) {
    return normalizeArrayInput(input, options);
  }

  if (isMomentLike(input)) {
    return DateTime.fromMillis(input.valueOf(), {
      zone: options?.zone,
      locale: options?.locale,
    });
  }

  if (DateTime.isDateTime(input)) {
    return input;
  }

  if (input instanceof Date) {
    return DateTime.fromJSDate(input, options);
  }

  if (typeof input === 'number') {
    return DateTime.fromMillis(input, options);
  }

  if (typeof input === 'string') {
    if (parseOptions?.format) {
      const formatted = parseWithFormats(input, parseOptions.format, options);

      if (formatted.isValid || parseOptions.strict) {
        return formatted;
      }
    }

    return parseWithFallbacks(input, options);
  }

  if (isInputObject(input)) {
    const normalized = { ...input };
    if (normalized.month != null) {
      normalized.month += 1;
    }
    return DateTime.fromObject(normalized, options);
  }

  return DateTime.invalid('unsupported moment input');
}

function isMomentLike(value: unknown): value is MomentLike {
  return (
    typeof value === 'object' &&
    value != null &&
    typeof (value as MomentLike).add === 'function' &&
    typeof (value as MomentLike).valueOf === 'function'
  );
}

function fieldAccessor(
  dtGetter: () => DateTime,
  dtSetter: (next: DateTime) => void,
  api: MomentLike,
  key: keyof InputObject,
  incoming?: number
): number | MomentLike {
  if (incoming == null) {
    const dt = dtGetter();

    switch (key) {
      case 'year':
        return dt.year;
      case 'month':
        return dt.month - 1;
      case 'day':
        return dt.day;
      case 'hour':
        return dt.hour;
      case 'minute':
        return dt.minute;
      case 'second':
        return dt.second;
      case 'millisecond':
        return dt.millisecond;
      default:
        return Number.NaN;
    }
  }

  if (key === 'month') {
    dtSetter(dtGetter().set({ month: incoming + 1 }));
  } else {
    dtSetter(dtGetter().set({ [key]: incoming }));
  }

  return api;
}

function createNames(kind: 'month' | 'weekday', width: LocaleUnit, locale = DEFAULT_LOCALE): string[] {
  const dateFmt = getCachedDateTimeFormatter(locale, {
    [kind]: width,
    timeZone: 'UTC',
  });

  if (kind === 'month') {
    return Array.from({ length: 12 }, (_, i) => dateFmt.format(new Date(Date.UTC(2020, i, 1))));
  }

  return Array.from({ length: 7 }, (_, i) => dateFmt.format(new Date(Date.UTC(2020, 5, 7 + i))));
}

function makeMoment(input?: MomentInput, options?: MomentOptions, parseOptions?: ParseOptions): MomentLike {
  let dt = normalizeInput(input, options, parseOptions);

  const setDt = (next: DateTime): MomentLike => {
    dt = next;
    return api;
  };

  const api: MomentLike = {
    add(value, unit) {
      const duration = normalizeDurationInput(value, unit);
      return setDt(dt.plus(duration));
    },

    subtract(value, unit) {
      const duration = normalizeDurationInput(value, unit);
      return setDt(dt.minus(duration));
    },

    startOf(unit) {
      return setDt(dt.startOf(normalizeStartEndUnit(unit)));
    },

    endOf(unit) {
      return setDt(dt.endOf(normalizeStartEndUnit(unit)));
    },

    set(valuesOrUnit: InputObject | UnitGetter, value?: number) {
      if (typeof valuesOrUnit === 'string') {
        if (value == null) {
          return api;
        }

        const unit = valuesOrUnit as UnitGetter;
        if (unit === 'month' || unit === 'months' || unit === 'M') {
          return setDt(dt.set({ month: value + 1 }));
        }
        if (unit === 'date') {
          return setDt(dt.set({ day: value }));
        }

        const normalized = normalizeUnit(unit as MomentUnit);
        return setDt(dt.set({ [normalized]: value }));
      }

      let values = valuesOrUnit;
      if (values.month != null) {
        values = { ...values, month: values.month + 1 };
      }

      return setDt(dt.set(values));
    },

    get(unit) {
      return getFieldByUnit(dt, unit);
    },

    locale(value) {
      return setDt(dt.setLocale(value));
    },

    utc(keepLocalTime = false) {
      return setDt(dt.setZone('utc', { keepLocalTime }));
    },

    local() {
      return setDt(dt.setZone('local'));
    },

    tz(zone, keepLocalTime = false) {
      return setDt(dt.setZone(zone, { keepLocalTime }));
    },

    clone() {
      return makeMoment(dt);
    },

    year(value?) {
      return fieldAccessor(() => dt, setDt, api, 'year', value);
    },

    month(value?) {
      return fieldAccessor(() => dt, setDt, api, 'month', value);
    },

    date(value?) {
      return fieldAccessor(() => dt, setDt, api, 'day', value);
    },

    hour(value?) {
      return fieldAccessor(() => dt, setDt, api, 'hour', value);
    },

    minute(value?) {
      return fieldAccessor(() => dt, setDt, api, 'minute', value);
    },

    second(value?) {
      return fieldAccessor(() => dt, setDt, api, 'second', value);
    },

    millisecond(value?) {
      return fieldAccessor(() => dt, setDt, api, 'millisecond', value);
    },

    day(value?) {
      const current = toMomentDay(dt.weekday);
      if (value == null) {
        return current;
      }

      return setDt(dt.plus({ days: value - current }));
    },

    weekday(value?) {
      return api.day(value);
    },

    isoWeekday(value?) {
      if (value == null) {
        return dt.weekday;
      }

      return setDt(dt.plus({ days: value - dt.weekday }));
    },

    week(value?) {
      if (value == null) {
        return dt.weekNumber;
      }

      return setDt(dt.plus({ weeks: value - dt.weekNumber }));
    },

    isoWeek(value?) {
      if (value == null) {
        return dt.weekNumber;
      }

      return setDt(dt.plus({ weeks: value - dt.weekNumber }));
    },



    isValid() {
      return dt.isValid;
    },

    isBefore(other, unit) {
      const b = normalizeInput(other);

      if (unit) {
        return dt.startOf(unit).toMillis() < b.startOf(unit).toMillis();
      }

      return dt.toMillis() < b.toMillis();
    },

    isAfter(other, unit) {
      const b = normalizeInput(other);

      if (unit) {
        return dt.startOf(unit).toMillis() > b.startOf(unit).toMillis();
      }

      return dt.toMillis() > b.toMillis();
    },

    isSame(other, unit) {
      const b = normalizeInput(other);

      if (unit) {
        return dt.startOf(unit).toMillis() === b.startOf(unit).toMillis();
      }

      return dt.toMillis() === b.toMillis();
    },

    diff(other, unit) {
      const b = normalizeInput(other);
      const diffUnit = normalizeDiffUnit(unit);
      return dt.diff(b, diffUnit).as(diffUnit);
    },

    toDate() {
      return dt.toJSDate();
    },

    toISOString() {
      return dt.toISO();
    },

    toJSON() {
      return dt.toJSON();
    },

    toString() {
      return dt.toString();
    },

    valueOf() {
      return dt.toMillis();
    },

    unix() {
      return Math.floor(dt.toSeconds());
    },

    toLocaleString() {
      return dt.toLocaleString(DateTime.DATETIME_MED);
    },

    utcOffset() {
      return dt.offset;
    },

    format(template) {
      if (template == null) {
        return dt.toISO({ precision: 'second' }) ?? '';
      }
      return formatWithOrdinal(dt, template);
    },

    fromNow(withoutSuffix = false) {
      const relative = dt.toRelative({
        style: 'long',
        locale: dt.locale ?? undefined,
      });

      if (!withoutSuffix || relative == null) {
        return relative ?? null;
      }

      return stripRelativeAffixes(relative);
    },

    toNow(withoutSuffix = false) {
      const relative = DateTime.now().toRelative({
        base: dt,
        style: 'long',
        locale: dt.locale ?? undefined,
      });

      if (!withoutSuffix || relative == null) {
        return relative ?? null;
      }

      return stripRelativeAffixes(relative);
    },

    from(input, withoutSuffix = false) {
      const base = normalizeInput(input);
      const relative = dt.toRelative({
        base,
        style: 'long',
        locale: dt.locale ?? undefined,
      });

      if (!withoutSuffix || relative == null) {
        return relative ?? null;
      }

      return stripRelativeAffixes(relative);
    },
  };

  return api;
}

function makeDuration(input?: MomentDurationInput, unit?: MomentUnit): MomentDurationLike {
  let duration = normalizeDurationInput((input as number | MomentDurationLike) ?? 0, unit);

  if (input == null) {
    duration = Duration.fromMillis(0);
  } else if (typeof input === 'string') {
    const parsed = Duration.fromISO(input);
    duration = parsed.isValid ? parsed : Duration.fromMillis(0);
  } else if (typeof input === 'object' && !isMomentDurationLike(input) && !Array.isArray(input)) {
    const obj: DurationLikeObject = {};
    for (const [rawUnit, value] of Object.entries(input)) {
      if (typeof value !== 'number') {
        continue;
      }

      const normalized = UNIT_MAP[rawUnit as MomentUnit] ?? (rawUnit as DurationUnit);
      obj[normalized] = value;
    }

    duration = Duration.fromObject(obj);
  }

  const setDuration = (next: Duration): MomentDurationLike => {
    duration = next;
    return api;
  };

  const api: MomentDurationLike = {
    add(value, incomingUnit) {
      return setDuration(duration.plus(normalizeDurationInput(value, incomingUnit)));
    },

    subtract(value, incomingUnit) {
      return setDuration(duration.minus(normalizeDurationInput(value, incomingUnit)));
    },

    as(targetUnit) {
      return duration.as(targetUnit);
    },

    asMilliseconds() {
      return duration.as('milliseconds');
    },

    asSeconds() {
      return duration.as('seconds');
    },

    asHours() {
      return duration.as('hours');
    },

    humanize(withSuffix = false) {
      const relative = DateTime.now().plus(duration).toRelative() ?? '';

      if (withSuffix) {
        return relative;
      }

      return stripRelativeAffixes(relative);
    },

    clone() {
      return makeDuration(duration.as('milliseconds'));
    },

    valueOf() {
      return duration.as('milliseconds');
    },

    milliseconds() {
      return duration.as('milliseconds');
    },

    seconds() {
      return duration.as('seconds');
    },

    minutes() {
      return duration.as('minutes');
    },

    hours() {
      return duration.as('hours');
    },

    days() {
      return duration.as('days');
    },

    weeks() {
      return duration.as('weeks');
    },

    months() {
      return duration.as('months');
    },

    years() {
      return duration.as('years');
    },
  };

  return api;
}

function isMomentDurationLike(value: unknown): value is MomentDurationLike {
  return (
    typeof value === 'object' &&
    value != null &&
    typeof (value as MomentDurationLike).humanize === 'function' &&
    typeof (value as MomentDurationLike).valueOf === 'function'
  );
}

interface MomentFactory {
  (input?: MomentInput, format?: MomentFormat, strict?: boolean): MomentLike;
  (input?: MomentInput, strict?: boolean): MomentLike;
  ISO_8601: typeof ISO_8601;
  utc(input?: MomentInput, format?: MomentFormat, strict?: boolean): MomentLike;
  unix(seconds: number): MomentLike;
  duration(input?: MomentDurationInput, unit?: MomentUnit): MomentDurationLike;
  isDuration(input: unknown): input is MomentDurationLike;
  isMoment(input: unknown): input is MomentLike;
  locale(locale?: string): string;
  localeData(locale?: string): { firstDayOfWeek: () => number };
  updateLocale(locale: string, config: { parentLocale?: string; week?: { dow?: number } }): string;
  tz: MomentTzFactory;
  months(locale?: string): string[];
  monthsShort(locale?: string): string[];
  weekdays(locale?: string): string[];
  weekdaysShort(locale?: string): string[];
  weekdaysMin(locale?: string): string[];
}

const moment: MomentFactory = ((
  input?: MomentInput,
  formatOrStrict?: MomentFormat | boolean,
  strict?: boolean
): MomentLike => {
  const parseOptions: ParseOptions = {};

  if (typeof formatOrStrict === 'string' || Array.isArray(formatOrStrict)) {
    parseOptions.format = formatOrStrict;
    parseOptions.strict = strict ?? false;
  } else if (typeof formatOrStrict === 'boolean') {
    parseOptions.strict = formatOrStrict;
  }

  return makeMoment(input, { locale: currentLocale }, parseOptions);
}) as MomentFactory;

moment.ISO_8601 = ISO_8601;

moment.locale = (locale?: string): string => {
  if (locale != null && locale !== '') {
    currentLocale = locale;
  }
  return currentLocale;
};

moment.localeData = (locale = currentLocale) => ({
  firstDayOfWeek: () => getLocaleFirstDayOfWeek(locale),
});

moment.updateLocale = (locale: string, config: { parentLocale?: string; week?: { dow?: number } }): string => {
  const parentLocale = config.parentLocale ?? locale;
  localeWeekStart[locale] = config.week?.dow ?? getLocaleFirstDayOfWeek(parentLocale);
  return locale;
};

moment.tz = ((input?: MomentInput, formatOrZone?: string, zoneMaybe?: string): MomentLike => {
  if (zoneMaybe != null) {
    return makeMoment(input, { zone: zoneMaybe, locale: currentLocale }, { format: formatOrZone });
  }

  if (formatOrZone != null) {
    return makeMoment(input, { zone: formatOrZone, locale: currentLocale });
  }

  return makeMoment(input, { locale: currentLocale });
}) as MomentTzFactory;

moment.tz.guess = (ignoreCache = false): string => {
  if (ignoreCache || cachedGuessedZone == null) {
    cachedGuessedZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  }

  return cachedGuessedZone;
};

moment.tz.zone = (name: string): MomentTimeZoneInfo | null => createTimeZoneInfo(name);

moment.tz.names = (): string[] => getSupportedTimeZones();

moment.utc = (input?: MomentInput, formatOrStrict?: MomentFormat | boolean, strict?: boolean): MomentLike => {
  const parseOptions: ParseOptions = {};

  if (typeof formatOrStrict === 'string' || Array.isArray(formatOrStrict)) {
    parseOptions.format = formatOrStrict;
    parseOptions.strict = strict ?? false;
  } else if (typeof formatOrStrict === 'boolean') {
    parseOptions.strict = formatOrStrict;
  }

  return makeMoment(input, { zone: 'utc', locale: currentLocale }, parseOptions).utc();
};

moment.unix = (seconds: number): MomentLike => makeMoment(seconds * 1000, { locale: currentLocale });

moment.duration = (input?: MomentDurationInput, unit?: MomentUnit): MomentDurationLike => makeDuration(input, unit);

moment.isDuration = (input: unknown): input is MomentDurationLike => isMomentDurationLike(input);

moment.isMoment = (input: unknown): input is MomentLike => isMomentLike(input);

moment.months = (locale = currentLocale): string[] => createNames('month', 'long', locale);

moment.monthsShort = (locale = currentLocale): string[] => createNames('month', 'short', locale);

moment.weekdays = (locale = currentLocale): string[] => createNames('weekday', 'long', locale);

moment.weekdaysShort = (locale = currentLocale): string[] => createNames('weekday', 'short', locale);

moment.weekdaysMin = (locale = currentLocale): string[] => createNames('weekday', 'narrow', locale);

export default moment;
