import { convertMomentToLuxonForParsing, convertMomentToLuxonWithOrdinal, formatWithOrdinal } from './format';
import { DateTime } from './luxon';

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
    expect(
      DateTime.fromFormat('03/05/2024', convertMomentToLuxonForParsing('L'), { zone: 'UTC' }).toISODate()
    ).toBe('2024-03-05');
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
