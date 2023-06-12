import { dateTime } from '../datetime';
import { TimeZone } from '../types';
import { DecimalCount } from '../types/displayValue';

import { toFixed, getValueFormat, scaledUnits, formattedValueToString } from './valueFormats';

interface ValueFormatTest {
  id: string;
  decimals?: DecimalCount;
  scaledDecimals?: DecimalCount;
  timeZone?: TimeZone;
  value: number;
  result: string;
}

describe('valueFormats', () => {
  it.each`
    format                | decimals     | value                                       | expected
    ${'currencyUSD'}      | ${2}         | ${1532.82}                                  | ${'$1.53K'}
    ${'currencyKRW'}      | ${2}         | ${1532.82}                                  | ${'₩1.53K'}
    ${'currencyIDR'}      | ${2}         | ${1532.82}                                  | ${'Rp1.53K'}
    ${'none'}             | ${undefined} | ${3.23}                                     | ${'3.23'}
    ${'none'}             | ${undefined} | ${0.0245}                                   | ${'0.0245'}
    ${'none'}             | ${undefined} | ${1 / 3}                                    | ${'0.333'}
    ${'ms'}               | ${4}         | ${0.0024}                                   | ${'0.0024 ms'}
    ${'ms'}               | ${0}         | ${100}                                      | ${'100 ms'}
    ${'ms'}               | ${2}         | ${1250}                                     | ${'1.25 s'}
    ${'ms'}               | ${1}         | ${10000086.123}                             | ${'2.8 hour'}
    ${'ms'}               | ${undefined} | ${1000}                                     | ${'1 s'}
    ${'ms'}               | ${0}         | ${1200}                                     | ${'1 s'}
    ${'short'}            | ${undefined} | ${1000}                                     | ${'1 K'}
    ${'short'}            | ${undefined} | ${1200}                                     | ${'1.20 K'}
    ${'short'}            | ${undefined} | ${1250}                                     | ${'1.25 K'}
    ${'short'}            | ${undefined} | ${1000000}                                  | ${'1 Mil'}
    ${'short'}            | ${undefined} | ${1500000}                                  | ${'1.50 Mil'}
    ${'short'}            | ${undefined} | ${1000120}                                  | ${'1.00 Mil'}
    ${'short'}            | ${undefined} | ${98765}                                    | ${'98.8 K'}
    ${'short'}            | ${undefined} | ${9876543}                                  | ${'9.88 Mil'}
    ${'short'}            | ${undefined} | ${9876543}                                  | ${'9.88 Mil'}
    ${'kbytes'}           | ${undefined} | ${10000000}                                 | ${'9.54 GiB'}
    ${'deckbytes'}        | ${undefined} | ${10000000}                                 | ${'10 GB'}
    ${'megwatt'}          | ${3}         | ${1000}                                     | ${'1.000 GW'}
    ${'kohm'}             | ${3}         | ${1000}                                     | ${'1.000 MΩ'}
    ${'Mohm'}             | ${3}         | ${1000}                                     | ${'1.000 GΩ'}
    ${'farad'}            | ${3}         | ${1000}                                     | ${'1.000 kF'}
    ${'µfarad'}           | ${3}         | ${1000}                                     | ${'1.000 mF'}
    ${'nfarad'}           | ${3}         | ${1000}                                     | ${'1.000 µF'}
    ${'pfarad'}           | ${3}         | ${1000}                                     | ${'1.000 nF'}
    ${'ffarad'}           | ${3}         | ${1000}                                     | ${'1.000 pF'}
    ${'henry'}            | ${3}         | ${1000}                                     | ${'1.000 kH'}
    ${'mhenry'}           | ${3}         | ${1000}                                     | ${'1.000 H'}
    ${'µhenry'}           | ${3}         | ${1000}                                     | ${'1.000 mH'}
    ${'a'}                | ${0}         | ${1532.82}                                  | ${'1533 a'}
    ${'b'}                | ${0}         | ${1532.82}                                  | ${'1533 b'}
    ${'prefix:b'}         | ${undefined} | ${1532.82}                                  | ${'b1533'}
    ${'suffix:d'}         | ${undefined} | ${1532.82}                                  | ${'1533 d'}
    ${'si:µF'}            | ${2}         | ${0}                                        | ${'0.00 µF'}
    ${'si:µF'}            | ${2}         | ${1234}                                     | ${'1.23 mF'}
    ${'si:µF'}            | ${2}         | ${1234000000}                               | ${'1.23 kF'}
    ${'si:µF'}            | ${2}         | ${1234000000000000}                         | ${'1.23 GF'}
    ${'count:xpm'}        | ${2}         | ${1234567}                                  | ${'1.23M xpm'}
    ${'count:x/min'}      | ${2}         | ${1234}                                     | ${'1.23K x/min'}
    ${'currency:@'}       | ${2}         | ${1234567}                                  | ${'@1.23M'}
    ${'currency:@'}       | ${2}         | ${1234}                                     | ${'@1.23K'}
    ${'time:YYYY'}        | ${0}         | ${dateTime(new Date(1999, 6, 2)).valueOf()} | ${'1999'}
    ${'time:YYYY.MM'}     | ${0}         | ${dateTime(new Date(2010, 6, 2)).valueOf()} | ${'2010.07'}
    ${'dateTimeAsIso'}    | ${0}         | ${dateTime(new Date(2010, 6, 2)).valueOf()} | ${'2010-07-02 00:00:00'}
    ${'dateTimeAsUS'}     | ${0}         | ${dateTime(new Date(2010, 6, 2)).valueOf()} | ${'07/02/2010 12:00:00 am'}
    ${'dateTimeAsSystem'} | ${0}         | ${dateTime(new Date(2010, 6, 2)).valueOf()} | ${'2010-07-02 00:00:00'}
    ${'dtdurationms'}     | ${undefined} | ${100000}                                   | ${'1 minute'}
  `(
    'With format=$format decimals=$decimals and value=$value then result shoudl be = $expected',
    async ({ format, value, decimals, expected }) => {
      const result = getValueFormat(format)(value, decimals, undefined, undefined);
      const full = formattedValueToString(result);
      expect(full).toBe(expected);
    }
  );

  it('Manually check a format', () => {
    // helpful for adding tests one at a time with the debugger
    const tests: ValueFormatTest[] = [
      { id: 'time:YYYY.MM', decimals: 0, value: dateTime(new Date(2010, 6, 2)).valueOf(), result: '2010.07' },
    ];
    const test = tests[0];
    const result = getValueFormat(test.id)(test.value, test.decimals, test.scaledDecimals);
    const full = formattedValueToString(result);
    expect(full).toBe(test.result);
  });

  describe('normal cases', () => {
    it('toFixed should handle number correctly if decimal is null', () => {
      expect(toFixed(100)).toBe('100');

      expect(toFixed(100.4)).toBe('100');
      expect(toFixed(100.5)).toBe('101');
      expect(toFixed(27.4)).toBe('27.4');
      expect(toFixed(27.5)).toBe('27.5');

      expect(toFixed(-100)).toBe('-100');

      expect(toFixed(-100.5)).toBe('-100');
      expect(toFixed(-100.6)).toBe('-101');
      expect(toFixed(-27.5)).toBe('-27.5');
      expect(toFixed(-27.6)).toBe('-27.6');
    });

    it('toFixed should handle number correctly if decimal is not null', () => {
      expect(toFixed(100, 1)).toBe('100.0');

      expect(toFixed(100.37, 1)).toBe('100.4');
      expect(toFixed(100.63, 1)).toBe('100.6');

      expect(toFixed(100.4, 2)).toBe('100.40');
      expect(toFixed(100.5, 2)).toBe('100.50');

      expect(toFixed(0, 1)).toBe('0.0');
      expect(toFixed(0, 2)).toBe('0.00');
    });
  });

  describe('format edge cases', () => {
    const negInf = Number.NEGATIVE_INFINITY.toLocaleString();
    const posInf = Number.POSITIVE_INFINITY.toLocaleString();

    it('toFixed should handle non number input gracefully', () => {
      expect(toFixed(NaN)).toBe('NaN');
      expect(toFixed(Number.NEGATIVE_INFINITY)).toBe(negInf);
      expect(toFixed(Number.POSITIVE_INFINITY)).toBe(posInf);
    });

    it('scaledUnits should handle non number input gracefully', () => {
      const disp = scaledUnits(5, ['a', 'b', 'c']);
      expect(disp(NaN).text).toBe('NaN');
      expect(disp(Number.NEGATIVE_INFINITY).text).toBe(negInf);
      expect(disp(Number.POSITIVE_INFINITY).text).toBe(posInf);
    });
  });

  describe('toFixed and negative decimals', () => {
    it('should treat as zero decimals', () => {
      const str = toFixed(186.123, -2);
      expect(str).toBe('186');
    });
  });

  describe('Resolve old units', () => {
    it('resolve farenheit', () => {
      const fmt0 = getValueFormat('farenheit');
      const fmt1 = getValueFormat('fahrenheit');
      expect(fmt0).toEqual(fmt1);
    });
  });
});
