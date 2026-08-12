import { convertMomentToLuxonWithOrdinal } from './format';
import moment from './moment';

// used by enterprise code (public/app/extensions), which in-repo usage scans don't cover, so this
// guards the API against being trimmed again. expected values verified against moment 2.30.1.
describe('isBetween', () => {
  const mk = (s: string) => moment.utc(s, 'YYYY-MM-DD HH:mm:ss');
  const lo = () => mk('2024-05-06 00:00:00');
  const mid = () => mk('2024-05-06 12:00:00');
  const hi = () => mk('2024-05-07 00:00:00');

  it('defaults to exclusive bounds', () => {
    expect(mid().isBetween(lo(), hi())).toBe(true);
    expect(lo().isBetween(lo(), hi())).toBe(false);
    expect(hi().isBetween(lo(), hi())).toBe(false);
  });

  it('honors inclusivity markers', () => {
    expect(lo().isBetween(lo(), hi(), undefined, '[]')).toBe(true);
    expect(hi().isBetween(lo(), hi(), undefined, '[]')).toBe(true);
    expect(lo().isBetween(lo(), hi(), undefined, '()')).toBe(false);
    expect(hi().isBetween(lo(), hi(), undefined, '[)')).toBe(false);
    expect(hi().isBetween(lo(), hi(), undefined, '(]')).toBe(true);
  });

  it('returns false outside the range and for reversed bounds (like moment)', () => {
    expect(mk('2024-05-08 00:00:00').isBetween(lo(), hi(), undefined, '[]')).toBe(false);
    expect(mid().isBetween(hi(), lo(), undefined, '[]')).toBe(false);
  });

  it('applies the unit to the endpoints as well as the instant (like moment)', () => {
    const a = mk('2024-05-06 11:00:00');
    const b = mk('2024-05-06 14:00:00');
    expect(mk('2024-05-06 13:00:00').isBetween(a, b, 'day', '[]')).toBe(true);
    expect(mk('2024-05-06 13:00:00').isBetween(a, b, 'day')).toBe(false);
  });
});

describe('diff', () => {
  const a = () => moment.utc('2024-05-10 18:00:00', 'YYYY-MM-DD HH:mm:ss');
  const b = () => moment.utc('2024-05-08 06:00:00', 'YYYY-MM-DD HH:mm:ss');

  it('truncates toward zero by default (like moment)', () => {
    expect(a().diff(b(), 'days')).toBe(2);
    expect(b().diff(a(), 'days')).toBe(-2);
    expect(b().diff(a(), 'years')).toBe(0);
  });

  it('returns fractions when asFloat is passed', () => {
    expect(a().diff(b(), 'days', true)).toBe(2.5);
    expect(b().diff(a(), 'days', true)).toBe(-2.5);
  });
});

describe('format', () => {
  it('uses Z for UTC in the default format', () => {
    expect(moment.utc('2024-05-08T10:30:45Z').format()).toBe('2024-05-08T10:30:45Z');
  });

  it('matches the longest moment token first', () => {
    expect(convertMomentToLuxonWithOrdinal('zz')).toBe('ZZZZZ');
    expect(convertMomentToLuxonWithOrdinal('z')).toBe('ZZZZ');
  });

  it('renders ZZ as a colon-less offset (like moment)', () => {
    expect(moment.utc('2024-05-08T10:30:45Z').format('ddd MMM DD YYYY HH:mm [GMT]ZZ')).toBe(
      'Wed May 08 2024 10:30 GMT+0000'
    );
  });

  it('omits z for the local system zone like moment', () => {
    expect(moment(1587126975779).format('z')).toBe('');
    expect(moment(1587126975779).format('[z] z')).toBe('z ');
  });

  it('renders L* tokens with locale-aware word order', () => {
    const d = () => moment.utc('1986-09-04T20:30:00Z');
    expect(d().format('LL')).toBe('September 4, 1986');
    expect(d().locale('fr').format('LL')).toBe('4 septembre 1986');
    expect(d().locale('fr').format('LLLL')).toBe('jeudi 4 septembre 1986 20:30');
    expect(d().locale('de').format('LT')).toBe('20:30');
  });

  it('matches moment formatting for invalid inputs', () => {
    expect(moment('not a date').format('YYYY-MM-DD')).toBe('Invalid date');
  });
});

describe('formatted string parsing', () => {
  it('accepts abbreviated month names for the long month token like moment', () => {
    const parsed = moment.utc('Aug 20, 2020 10:30:20 am', 'MMMM D, YYYY, h:mm:ss a');

    expect(parsed.isValid()).toBe(true);
    expect(parsed.toISOString()).toBe('2020-08-20T10:30:20.000Z');
  });

  it('parses lowercase meridiem tokens without falling back to the local timezone', () => {
    const parsed = moment.utc('Aug 20, 2020 10:30:20 am', 'MMM D, YYYY h:mm:ss a');

    expect(parsed.isValid()).toBe(true);
    expect(parsed.toISOString()).toBe('2020-08-20T10:30:20.000Z');
  });
});

describe('relative time', () => {
  it('matches moment invalid-date behavior for every relative helper', () => {
    const invalid = moment('not a date');
    const valid = moment.utc('2024-05-08T00:00:00Z');

    expect(invalid.fromNow()).toBe('Invalid date');
    expect(invalid.toNow()).toBe('Invalid date');
    expect(valid.from(invalid)).toBe('Invalid date');
  });

  it.each([
    ['en', '2 days'],
    ['de', '2 Tage'],
    ['fr', '2 jours'],
  ])('formats suffixless durations in %s', (locale, expected) => {
    const base = moment.utc('2024-05-06T00:00:00Z');
    const target = moment.utc('2024-05-08T00:00:00Z').locale(locale);

    expect(target.from(base, true)).toBe(expected);
  });
});

describe('string parsing fallbacks', () => {
  it('parses RFC 2822 strings missing their timezone via the js Date() fallback (like moment)', () => {
    // real-world example: grafana.com's RSS feed emits zoneless pubDates, which the luxon
    // parsers reject but moment accepted through its js Date() last resort
    const pubDate = 'Wed, 22 Jul 2026 15:27:07';
    const parsed = moment(pubDate);

    expect(parsed.isValid()).toBe(true);
    // both interpret the string in the environment's local zone
    expect(parsed.valueOf()).toBe(new Date(pubDate).getTime());
  });

  it('stays invalid for garbage input', () => {
    expect(moment('not a date').isValid()).toBe(false);
  });
});

describe('unix timestamp format tokens', () => {
  // luxon's fromFormat cannot parse X/x (they are output-only), so the shim special-cases them.
  // used by e.g. the convertFieldType transformation with dateFormat: 'X'.
  it('parses unix seconds strings with the X token', () => {
    expect(moment('1759565902', 'X').valueOf()).toBe(1759565902000);
    expect(moment('1759565902.5', 'X').valueOf()).toBe(1759565902500);
    expect(moment('-86400', 'X').valueOf()).toBe(-86400000);
  });

  it('parses unix millisecond strings with the x token', () => {
    expect(moment('1759565902000', 'x').valueOf()).toBe(1759565902000);
  });

  it('stays invalid for non-numeric input', () => {
    expect(moment('garbage', 'X').isValid()).toBe(false);
    expect(moment('', 'X').isValid()).toBe(false);
  });
});

describe('year/month/date accessors', () => {
  it('gets with moment semantics (0-based month, 1-based day)', () => {
    const d = moment.utc([2024, 4, 6]);
    expect(d.year()).toBe(2024);
    expect(d.month()).toBe(4);
    expect(d.date()).toBe(6);
  });

  it('sets with moment semantics', () => {
    const d = moment.utc([2024, 4, 6]);
    d.year(2025);
    d.month(0);
    d.date(15);
    expect(d.toISOString()).toBe('2025-01-15T00:00:00.000Z');
  });

  it('sets week units without passing unsupported fields to luxon', () => {
    const input = '2024-05-06 10:30:45';

    expect(moment.utc(input).set('week', 20).week()).toBe(20);
    expect(moment.utc(input).set('weeks', 20).week()).toBe(20);
    expect(moment.utc(input).set('w', 20).week()).toBe(20);
    expect(moment.utc(input).set('isoWeek', 20).week()).toBe(20);
  });

  it('exposes plural aliases for every unit (used by decoupled plugin repos)', () => {
    const d = moment.utc('2024-05-06 10:30:45.123', 'YYYY-MM-DD HH:mm:ss.SSS');
    expect(d.years()).toBe(d.year());
    expect(d.months()).toBe(d.month());
    expect(d.dates()).toBe(d.date());
    expect(d.days()).toBe(d.day());
    expect(d.weeks()).toBe(d.week());
    expect(d.isoWeeks()).toBe(d.isoWeek());
    expect(d.hours()).toBe(10);
    expect(d.minutes()).toBe(30);
    expect(d.seconds()).toBe(45);
    expect(d.milliseconds()).toBe(123);

    d.hours(3).minutes(4);
    expect(d.hour()).toBe(3);
    expect(d.minute()).toBe(4);
  });
});

describe('tz.zone', () => {
  it('returns zone information for IANA names and null for everything else', () => {
    expect(moment.tz.zone('America/New_York')?.name).toBe('America/New_York');
    expect(moment.tz.zone('UTC')?.name).toBe('UTC');
    expect(moment.tz.zone('utc')?.name).toBe('UTC');
    expect(moment.tz.zone('browser')).toBeNull();
    expect(moment.tz.zone('not/a-zone')).toBeNull();
    expect(moment.tz.zone('')).toBeNull();
  });

  it('uses cached easy-tz data and canonicalizes legacy zone names', () => {
    const jan = Date.UTC(2026, 0, 15);
    const jul = Date.UTC(2026, 6, 15);
    const zone = moment.tz.zone('Asia/Calcutta');

    expect(zone?.name).toBe('Asia/Kolkata');
    expect(zone?.abbr(jan)).toBe('IST');
    expect(zone?.utcOffset(jan)).toBe(-330);
    expect(moment.tz(jul, 'Asia/Calcutta').tz()).toBe('Asia/Kolkata');
    expect(moment.tz(jul, 'Asia/Calcutta').utcOffset()).toBe(330);
    expect(moment.tz(jan, 'America/New_York').utcOffset()).toBe(-300);
    expect(moment.tz(jul, 'America/New_York').utcOffset()).toBe(-240);
    expect(moment.tz(jan, 'America/New_York').format('z')).toBe('EST');
    expect(moment.tz(jul, 'America/New_York').format('z')).toBe('EDT');
  });
});

describe('duration component getters', () => {
  it('returns integer components like moment, not fractional totals', () => {
    const d = moment.duration(90, 'minutes');
    expect(d.hours()).toBe(1);
    expect(d.minutes()).toBe(30);
    expect(d.seconds()).toBe(0);
    expect(d.asHours()).toBe(1.5);
    expect(d.asMilliseconds()).toBe(5400000);
  });

  it('returns 0 components for sub-second durations (like moment)', () => {
    const d = moment.duration(23, 'milliseconds');
    expect(d.hours()).toBe(0);
    expect(d.minutes()).toBe(0);
    expect(d.seconds()).toBe(0);
    expect(d.asSeconds()).toBe(0.023);
  });

  it('truncates seconds and carries hours into days (like moment)', () => {
    const d = moment.duration(25 * 3600 * 1000 + 1500);
    expect(d.hours()).toBe(1);
    expect(d.minutes()).toBe(0);
    expect(d.seconds()).toBe(1);
  });

  it('returns negative components for negative durations (like moment)', () => {
    const d = moment.duration(-90, 'seconds');
    expect(d.minutes()).toBe(-1);
    expect(d.seconds()).toBe(-30);
  });
});
