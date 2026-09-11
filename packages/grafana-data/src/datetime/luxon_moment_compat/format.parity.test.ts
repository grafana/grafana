import { convertMomentToLuxonForParsing, convertMomentToLuxonWithOrdinal, formatWithOrdinal } from './format';
import { DateTime } from './luxon';

describe('weekday tokens', () => {
  it.each([
    { locale: 'en-US', date: '2024-05-05', expected: '0 Su' },
    { locale: 'de', date: '2024-05-08', expected: '3 Mi' },
    { locale: 'fr', date: '2024-05-07', expected: '2 ma' },
    { locale: 'ja', date: '2024-05-06', expected: '1 月' },
  ])('formats numeric and minimal weekdays in $locale', ({ locale, date, expected }) => {
    expect(formatWithOrdinal(DateTime.fromISO(date, { locale, zone: 'UTC' }), 'd dd')).toBe(expected);
  });

  it('keeps escaped weekday tokens and day-of-month tokens distinct', () => {
    const date = DateTime.utc(2024, 5, 5).setLocale('en-US');
    expect(formatWithOrdinal(date, '[d dd] \\d d dd DD [ddd]')).toBe('d dd d 0 Su 05 ddd');
  });
});

describe('localized llll', () => {
  it.each([
    { locale: 'en-US', expected: 'Tue, Mar 5, 2024, 8:05 AM' },
    { locale: 'fr', expected: 'mar. 5 mars 2024, 08:05' },
    { locale: 'de', expected: 'Di, 5. Mär 2024, 08:05' },
    { locale: 'ja', expected: '2024/3/5(火) 8:05' },
  ])('formats and parses locale-specific field order and time in $locale', ({ locale, expected }) => {
    const date = DateTime.utc(2024, 3, 5, 8, 5).setLocale(locale);
    const formatted = formatWithOrdinal(date, 'llll');

    expect(formatted).toBe(expected);
    expect(
      DateTime.fromFormat(formatted, convertMomentToLuxonForParsing('llll', locale), { locale, zone: 'UTC' }).toISO()
    ).toBe('2024-03-05T08:05:00.000Z');
  });

  it('preserves bracket literals alongside the localized macro', () => {
    const date = DateTime.utc(2024, 3, 5, 8, 5).setLocale('fr');
    expect(formatWithOrdinal(date, '[llll] llll [L]')).toBe('llll mar. 5 mars 2024, 08:05 L');
  });
});

describe('localized padded L', () => {
  it.each([
    { locale: 'en-US', expected: '03/05/2024' },
    { locale: 'en-GB', expected: '05/03/2024' },
    { locale: 'de', expected: '05.03.2024' },
    { locale: 'ja', expected: '2024/03/05' },
  ])('formats and parses padded L in $locale', ({ locale, expected }) => {
    const date = DateTime.utc(2024, 3, 5).setLocale(locale);
    const formatted = formatWithOrdinal(date, 'L');

    expect(formatted).toBe(expected);
    expect(
      DateTime.fromFormat(formatted, convertMomentToLuxonForParsing('L', locale), { locale, zone: 'UTC' }).toISODate()
    ).toBe('2024-03-05');
  });

  it('uses the supplied conversion locale and defaults to en-US', () => {
    const date = DateTime.utc(2024, 3, 5).setLocale('en-US');

    expect(date.toFormat(convertMomentToLuxonWithOrdinal('L'))).toBe('03/05/2024');
    expect(date.toFormat(convertMomentToLuxonWithOrdinal('L', 'de'))).toBe('05.03.2024');
    expect(DateTime.fromFormat('03/05/2024', convertMomentToLuxonForParsing('L'), { zone: 'UTC' }).toISODate()).toBe(
      '2024-03-05'
    );
  });

  it('keeps cached conversions separate when alternating locales', () => {
    const date = DateTime.utc(2024, 3, 5);
    expect(formatWithOrdinal(date.setLocale('en-US'), 'L [cache]')).toBe('03/05/2024 cache');
    expect(formatWithOrdinal(date.setLocale('de'), 'L [cache]')).toBe('05.03.2024 cache');
    expect(formatWithOrdinal(date.setLocale('en-US'), 'L [cache]')).toBe('03/05/2024 cache');
  });

  it.each([
    { format: '[L yyyyy] L', expected: 'L yyyyy 05.03.2024' },
    { format: '\\L L', expected: 'L 05.03.2024' },
    { format: 'L [|] L', expected: '05.03.2024 | 05.03.2024' },
  ])('preserves literals when converting $format', ({ format, expected }) => {
    const date = DateTime.utc(2024, 3, 5).setLocale('de');
    const formatted = formatWithOrdinal(date, format);

    expect(formatted).toBe(expected);
    expect(
      DateTime.fromFormat(formatted, convertMomentToLuxonForParsing(format, 'de'), {
        locale: 'de',
        zone: 'UTC',
      }).toISODate()
    ).toBe('2024-03-05');
  });
});
