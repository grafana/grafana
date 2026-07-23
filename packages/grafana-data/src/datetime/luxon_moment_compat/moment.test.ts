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
  it('renders ZZ as a colon-less offset (like moment)', () => {
    expect(moment.utc('2024-05-08T10:30:45Z').format('ddd MMM DD YYYY HH:mm [GMT]ZZ')).toBe(
      'Wed May 08 2024 10:30 GMT+0000'
    );
  });

  it('renders L* tokens with locale-aware word order', () => {
    const d = () => moment.utc('1986-09-04T20:30:00Z');
    expect(d().format('LL')).toBe('September 4, 1986');
    expect(d().locale('fr').format('LL')).toBe('4 septembre 1986');
    expect(d().locale('fr').format('LLLL')).toBe('jeudi 4 septembre 1986 20:30');
    expect(d().locale('de').format('LT')).toBe('20:30');
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
