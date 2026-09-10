import { DateTime, Settings } from './luxon';
import moment from './moment';

describe('moment compatibility parity', () => {
  let originalLocale: string;
  let originalDefaultLocale: typeof Settings.defaultLocale;
  let originalNow: typeof Settings.now;

  beforeEach(() => {
    originalLocale = moment.locale();
    originalDefaultLocale = Settings.defaultLocale;
    originalNow = Settings.now;

    moment.locale('en');
  });

  afterEach(() => {
    moment.locale(originalLocale);
    Settings.defaultLocale = originalDefaultLocale;
    Settings.now = originalNow;
  });

  describe('shared scalar duration inputs', () => {
    it.each([300000, '300000', 'PT5M', '5m'])('uses %s for duration, addition, and subtraction', (input) => {
      expect(moment.duration(input).asMilliseconds()).toBe(300000);
      expect(moment.utc('2024-05-06T12:00:00Z').add(input).toISOString()).toBe('2024-05-06T12:05:00.000Z');
      expect(moment.utc('2024-05-06T12:00:00Z').subtract(input).toISOString()).toBe('2024-05-06T11:55:00.000Z');
    });

    it.each([2, '2'])('applies an explicit unit to the numeric input %s', (input) => {
      expect(moment.duration(input, 'hours').asMilliseconds()).toBe(7200000);
      expect(moment.utc('2024-05-06T12:00:00Z').add(input, 'hours').toISOString()).toBe('2024-05-06T14:00:00.000Z');
      expect(moment.utc('2024-05-06T12:00:00Z').subtract(input, 'hours').toISOString()).toBe(
        '2024-05-06T10:00:00.000Z'
      );
    });

    it('parses a common compound ISO duration without dropping its date or time components', () => {
      expect(moment.duration('P1DT2H30M').asHours()).toBe(26.5);
      expect(moment.utc('2024-05-06T12:00:00Z').add('P1DT2H30M').toISOString()).toBe('2024-05-07T14:30:00.000Z');
      expect(moment.utc('2024-05-06T12:00:00Z').subtract('P1DT2H30M').toISOString()).toBe('2024-05-05T09:30:00.000Z');
    });

    it('treats malformed durations as zero across construction and arithmetic', () => {
      expect(moment.duration('garbage').asMilliseconds()).toBe(0);
      expect(moment.utc(0).add('garbage').valueOf()).toBe(0);
      expect(moment.utc(0).subtract('garbage').valueOf()).toBe(0);
    });

    it('treats an unknown scalar unit as zero rather than milliseconds', () => {
      // @ts-expect-error Exercise unsupported units from untyped callers.
      expect(moment.duration(5, 'fortnights').asMilliseconds()).toBe(0);
      // @ts-expect-error Exercise unsupported units from untyped callers.
      expect(moment.utc(0).add(5, 'fortnights').valueOf()).toBe(0);
      // @ts-expect-error Exercise unsupported units from untyped callers.
      expect(moment.utc(0).subtract(5, 'fortnights').valueOf()).toBe(0);
    });

    it.each([NaN, Infinity, -Infinity])('returns invalid results without throwing for %s', (input) => {
      const duration = moment.duration(input, 'hours');
      expect(duration.asMilliseconds()).toBeNaN();
      expect(duration.hours()).toBeNaN();
      expect(moment.utc(0).add(input, 'hours').isValid()).toBe(false);
      expect(moment.utc(0).subtract(input, 'hours').isValid()).toBe(false);
      expect(moment(input).isValid()).toBe(false);
    });

    it.each([
      {
        value: 1.5,
        addedMonth: '2024-03-31',
        subtractedMonth: '2023-11-30',
        addedDay: '2024-02-02',
        subtractedDay: '2024-01-29',
      },
      {
        value: -1.5,
        addedMonth: '2023-11-30',
        subtractedMonth: '2024-03-31',
        addedDay: '2024-01-29',
        subtractedDay: '2024-02-02',
      },
    ])(
      'rounds signed fractional calendar units away from zero for $value',
      ({ value, addedMonth, subtractedMonth, addedDay, subtractedDay }) => {
        const base = moment.utc('2024-01-31T00:00:00Z');
        expect(base.clone().add(value, 'month').format('YYYY-MM-DD')).toBe(addedMonth);
        expect(base.clone().subtract(value, 'month').format('YYYY-MM-DD')).toBe(subtractedMonth);
        expect(base.clone().add(value, 'day').format('YYYY-MM-DD')).toBe(addedDay);
        expect(base.clone().subtract(value, 'day').format('YYYY-MM-DD')).toBe(subtractedDay);
      }
    );

    it('converts fractional years and weeks to months and days before rounding', () => {
      const value = moment.utc('2024-01-31');
      expect(value.clone().add(0.5, 'years').format('YYYY-MM-DD')).toBe('2024-07-31');
      expect(value.clone().add(0.5, 'weeks').format('YYYY-MM-DD')).toBe('2024-02-04');
    });

    it('retains fractional days in durations instead of applying calendar arithmetic rounding', () => {
      expect(moment.duration(1.5, 'days').asHours()).toBe(36);
      expect(moment.duration(-1.5, 'days').asHours()).toBe(-36);
    });
  });

  describe('duration objects', () => {
    it('uses duration-instance totals for copies, addition, and subtraction', () => {
      const duration = moment.duration(5, 'minutes');
      const value = moment.utc('2024-05-08T12:00:00Z');

      expect(moment.duration(duration).asMilliseconds()).toBe(300000);
      expect(value.clone().add(duration).toISOString()).toBe('2024-05-08T12:05:00.000Z');
      expect(value.clone().subtract(duration).toISOString()).toBe('2024-05-08T11:55:00.000Z');
    });

    it('retains elapsed-millisecond arithmetic for duration instances across DST', () => {
      const value = moment.tz('2024-03-09T12:00:00', 'America/New_York');
      expect(value.add(moment.duration(1, 'day')).toISOString()).toBe('2024-03-10T17:00:00.000Z');
    });

    it('preserves invalid duration-instance totals', () => {
      const duration = moment.duration(NaN);
      expect(moment.duration(duration).asMilliseconds()).toBeNaN();
      expect(moment.utc(0).add(duration).isValid()).toBe(false);
    });

    it.each([
      { form: 'singular', input: { hour: 1, minute: '30' } },
      { form: 'plural', input: { hours: 1, minutes: '30' } },
      { form: 'short', input: { h: 1, m: '30' } },
    ])('accepts $form keys with numeric and numeric-string values', ({ input }) => {
      expect(moment.duration(input).asMilliseconds()).toBe(5400000);
    });

    it('uses the last alias in property order instead of accumulating aliases', () => {
      expect(moment.duration({ hour: 1, hours: 2, h: '3' }).asHours()).toBe(3);
      expect(moment.duration({ h: '3', hours: 2, hour: 1 }).asHours()).toBe(1);
      expect(moment.duration({ hour: 'invalid', hours: 2 }).asHours()).toBe(2);
      expect(moment.duration({ hours: 2, hour: undefined }).asHours()).toBe(0);
    });

    it('uses mixed units in arithmetic without changing the input or applying an explicit unit', () => {
      const input = Object.freeze({ hour: 1, hours: 2, minutes: '30' });
      const value = moment.utc('2024-05-08T12:00:00Z');

      expect(moment.duration(input, 'seconds').asMilliseconds()).toBe(9000000);
      expect(value.add(input, 'seconds')).toBe(value);
      expect(value.toISOString()).toBe('2024-05-08T14:30:00.000Z');
      expect(value.subtract(input).toISOString()).toBe('2024-05-08T12:00:00.000Z');
    });

    it('preserves calendar months and calendar days across month ends and DST', () => {
      expect(moment.utc('2024-01-31T12:00:00Z').add({ month: 1, minutes: 30 }).toISOString()).toBe(
        '2024-02-29T12:30:00.000Z'
      );
      expect(moment.tz('2024-03-09T12:00:00', 'America/New_York').add({ day: 1, hours: 2 }).toISOString()).toBe(
        '2024-03-10T18:00:00.000Z'
      );
    });

    it('ignores inherited and unknown keys', () => {
      const input = Object.assign(Object.create({ hours: 5 }), { minutes: 30, fortnights: 2, toString: 5 });
      expect(moment.duration(input).asMilliseconds()).toBe(1800000);
      expect(moment.duration({}).asMilliseconds()).toBe(0);
    });

    it('validates the final value after aliases overwrite earlier values', () => {
      expect(moment.duration({ hour: 1, hours: 'invalid' }).asMilliseconds()).toBeNaN();
    });
  });

  describe('composite shorthand durations', () => {
    it.each([
      { input: '1h30m', milliseconds: 5400000 },
      { input: '1.5h30m', milliseconds: 7200000 },
      { input: '2m500ms', milliseconds: 120500 },
      { input: '1h1h', milliseconds: 7200000 },
      { input: '-1h30m', milliseconds: -5400000 },
      { input: '+1h30m', milliseconds: 5400000 },
    ])('parses $input as an elapsed duration', ({ input, milliseconds }) => {
      expect(moment.duration(input).asMilliseconds()).toBe(milliseconds);
    });

    it('keeps calendar months distinct from minutes and ignores an explicit unit', () => {
      const value = moment.utc('2024-01-31T12:00:00Z');
      expect(value.add('1M30m', 'seconds')).toBe(value);
      expect(value.toISOString()).toBe('2024-02-29T12:30:00.000Z');

      expect(moment.duration('1h30m', 'seconds').asMilliseconds()).toBe(5400000);
    });

    it('adds a calendar day across DST without converting it to 24 elapsed hours', () => {
      const value = moment.tz('2024-03-09T12:00:00', 'America/New_York');
      expect(value.add('1d2h').toISOString()).toBe('2024-03-10T18:00:00.000Z');
    });

    it.each(['1h-30m', '1h+30m', '1h30garbage', '1h30', '1h 30m'])('rejects all of %s', (input) => {
      expect(moment.duration(input).asMilliseconds()).toBe(0);
    });

    it('starts each scan independently after a malformed input', () => {
      expect(moment.duration('1h30garbage').asMilliseconds()).toBe(0);
      expect(moment.duration('1h30m').asMilliseconds()).toBe(5400000);
      expect(moment.duration('5m').asMilliseconds()).toBe(300000);
    });
  });

  describe('locale and week semantics', () => {
    it('gets the instance locale without changing it or adopting a later global locale', () => {
      const value = moment.utc('2024-05-06').locale('de');
      moment.locale('fr');

      expect(value.locale()).toBe('de');
      expect(value.format('MMMM')).toBe('Mai');
      expect(moment.locale()).toBe('fr');
    });

    it('activates a synthetic locale and retains its parent for Intl after another update', () => {
      moment.updateLocale('parity-week', { parentLocale: 'de', week: { dow: 2 } });

      expect(moment.locale()).toBe('parity-week');
      expect(moment.utc('2024-05-08').locale()).toBe('parity-week');
      expect(moment.utc('2024-05-08').format('MMMM')).toBe('Mai');
      expect(moment.localeData().firstDayOfWeek()).toBe(2);

      moment.updateLocale('parity-week', { week: { dow: 4 } });
      expect(moment.utc('2024-05-08').format('MMMM')).toBe('Mai');
      expect(moment.utc('2024-05-08').startOf('week').toISOString()).toBe('2024-05-02T00:00:00.000Z');
    });

    it.each([
      { locale: 'en-US', dow: 0, start: '2024-05-05T00:00:00.000Z', end: '2024-05-11T23:59:59.999Z' },
      { locale: 'de', dow: 1, start: '2024-05-06T00:00:00.000Z', end: '2024-05-12T23:59:59.999Z' },
    ])('uses $locale defaults for singular and plural week boundaries', ({ locale, dow, start, end }) => {
      const value = moment.utc('2024-05-08T12:00:00Z').locale(locale);
      expect(moment.localeData(locale).firstDayOfWeek()).toBe(dow);
      expect(value.clone().startOf('week').toISOString()).toBe(start);
      expect(value.clone().startOf('weeks').toISOString()).toBe(start);
      expect(value.clone().endOf('week').toISOString()).toBe(end);
      expect(value.clone().endOf('weeks').toISOString()).toBe(end);
    });

    it('keeps ISO week boundaries on Monday in a Sunday-first locale', () => {
      const value = moment.utc('2024-05-08T12:00:00Z').locale('en-US');
      expect(value.clone().startOf('isoWeek').toISOString()).toBe('2024-05-06T00:00:00.000Z');
      expect(value.clone().endOf('isoWeek').toISOString()).toBe('2024-05-12T23:59:59.999Z');
    });

    it('gets and sets weekday relative to the locale rather than Sunday', () => {
      const value = moment.utc('2024-05-08T12:00:00Z').locale('de');
      expect(value.day()).toBe(3);
      expect(value.weekday()).toBe(2);
      expect(value.clone().weekday(0).toISOString()).toBe('2024-05-06T12:00:00.000Z');
      expect(value.clone().weekday(-1).toISOString()).toBe('2024-05-05T12:00:00.000Z');
    });
  });

  describe('construction and zone conversion', () => {
    it('preserves the locale and system-zone identity when copying a local instance', () => {
      const source = moment('2024-05-06T12:00:00').locale('de');
      moment.locale('fr');

      const copy = moment(source);
      expect(copy.locale()).toBe('de');
      expect(copy.format('YYYY-MM-DD HH:mm [zone:]z')).toBe('2024-05-06 12:00 zone:');
      copy.add(1, 'day');
      expect(source.format('YYYY-MM-DD HH:mm')).toBe('2024-05-06 12:00');
    });

    it('preserves a named zone and locale when cloning or copying', () => {
      const source = moment.tz('2024-05-06T12:00:00', 'America/New_York').locale('de');
      moment.locale('fr');

      for (const copy of [source.clone(), moment(source)]) {
        expect(copy.locale()).toBe('de');
        expect(copy.tz()).toBe('America/New_York');
        expect(copy.toISOString()).toBe('2024-05-06T16:00:00.000Z');
      }
    });

    it('constructs from raw Luxon input and honors an explicit destination zone', () => {
      const raw = DateTime.fromISO('2024-05-06T12:00:00', { zone: 'America/New_York', locale: 'de' });
      const copied = moment(raw);
      expect(copied.locale()).toBe('de');
      expect(copied.tz()).toBe('America/New_York');
      expect(copied.toISOString()).toBe('2024-05-06T16:00:00.000Z');

      const converted = moment.tz(raw, 'Asia/Tokyo');
      expect(converted.tz()).toBe('Asia/Tokyo');
      expect(converted.format('YYYY-MM-DD HH:mm Z')).toBe('2024-05-07 01:00 +09:00');
      expect(moment.utc(raw).toISOString()).toBe('2024-05-06T16:00:00.000Z');
    });

    it('treats the single tz argument as the zone for the current instant', () => {
      Settings.now = () => 1714996800000;
      const value = moment.tz('America/New_York');
      expect(value.tz()).toBe('America/New_York');
      expect(value.toISOString()).toBe('2024-05-06T12:00:00.000Z');
      expect(value.format('HH:mm Z')).toBe('08:00 -04:00');
    });

    it('preserves wall time with local(true), but preserves the instant with local()', () => {
      const source = moment.tz('2024-05-06T12:00:00', 'America/New_York');
      expect(source.clone().local(true).format('YYYY-MM-DD HH:mm')).toBe('2024-05-06 12:00');
      expect(source.clone().local().toISOString()).toBe('2024-05-06T16:00:00.000Z');
    });
  });

  describe('parsing and invalid values', () => {
    it('makes explicit ISO parsing authoritative instead of accepting an RFC fallback', () => {
      expect(moment.utc('2024-05-06T12:00:00+02:00', moment.ISO_8601).toISOString()).toBe('2024-05-06T10:00:00.000Z');
      expect(moment.utc('Mon, 06 May 2024 12:00:00 GMT', moment.ISO_8601).isValid()).toBe(false);
    });

    it('does not normalize an impossible ISO date through the native Date fallback', () => {
      expect(moment.utc('2024-02-30').isValid()).toBe(false);
      expect(moment.utc('2024-02-30', 'YYYY-MM-DD').isValid()).toBe(false);
    });

    it('does not discard a mismatched RFC weekday through the native Date fallback', () => {
      expect(moment.utc('Tue, 06 May 2024 12:00:00 GMT').isValid()).toBe(false);
    });

    it('returns NaN for diff with an invalid receiver or operand', () => {
      const valid = moment.utc('2024-05-06');
      const invalid = moment(null);
      expect(valid.diff(invalid, 'days')).toBeNaN();
      expect(invalid.diff(valid, 'days')).toBeNaN();
      expect(valid.diff(invalid, 'hours', true)).toBeNaN();
    });

    it('rejects invalid receivers and endpoints even with inclusive bounds', () => {
      const start = moment.utc('2024-05-06');
      const end = moment.utc('2024-05-08');
      const value = moment.utc('2024-05-07');
      const invalid = moment(null);
      expect(invalid.isBetween(start, end, 'day', '[]')).toBe(false);
      expect(value.isBetween(invalid, end, 'day', '[]')).toBe(false);
      expect(value.isBetween(start, invalid, 'day', '[]')).toBe(false);
      expect(value.isSame(invalid, 'day')).toBe(false);
      expect(value.isBefore(invalid, 'day')).toBe(false);
      expect(value.isAfter(invalid, 'day')).toBe(false);
    });
  });

  it('compares day boundaries in the receiver zone rather than each operand zone', () => {
    const value = moment.tz('2024-05-06T23:30:00', 'America/New_York');
    const sameDay = moment.utc('2024-05-07T01:00:00Z');
    const nextDay = moment.utc('2024-05-07T05:00:00Z');
    const previousDay = moment.utc('2024-05-06T03:00:00Z');

    expect(value.isSame(sameDay, 'day')).toBe(true);
    expect(value.isBefore(sameDay, 'day')).toBe(false);
    expect(value.isAfter(sameDay, 'day')).toBe(false);
    expect(value.isBefore(nextDay, 'day')).toBe(true);
    expect(value.isAfter(previousDay, 'day')).toBe(true);
    expect(value.isBetween(sameDay, nextDay, 'day', '[)')).toBe(true);
    expect(value.isBetween(sameDay, nextDay, 'day', '()')).toBe(false);
  });

  describe('calendar fields and serialization', () => {
    it('distinguishes day of week from day of month in get and set', () => {
      const value = moment.utc('2024-05-08T12:00:00Z');
      expect(value.get('day')).toBe(3);
      expect(value.get('date')).toBe(8);
      expect(value.clone().set('day', 0).toISOString()).toBe('2024-05-05T12:00:00.000Z');
      expect(value.clone().set('date', 1).toISOString()).toBe('2024-05-01T12:00:00.000Z');
    });

    it('sets quarter while retaining the month within the quarter and clamping the date', () => {
      const value = moment.utc('2024-05-31T12:00:00Z');
      expect(value.get('quarter')).toBe(2);
      expect(value.set('quarter', 1).toISOString()).toBe('2024-02-29T12:00:00.000Z');
    });

    it('gets the ISO week across the calendar year boundary', () => {
      const value = moment.utc('2021-01-01').locale('en-US');
      expect(value.isoWeek()).toBe(53);
      expect(value.get('isoWeek')).toBe(53);
    });

    it('serializes a zoned date as UTC JSON and an invalid date as null', () => {
      const value = moment.tz('2024-05-06T12:00:00', 'America/New_York');
      expect(value.toJSON()).toBe('2024-05-06T16:00:00.000Z');
      expect(JSON.stringify({ at: value })).toBe('{"at":"2024-05-06T16:00:00.000Z"}');
      expect(moment(null).toJSON()).toBeNull();
    });
  });
});
