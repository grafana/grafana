import { toFixed, getValueFormat, scaledUnits, formattedValueToString } from './valueFormats';
import { DecimalCount } from '../types/displayValue';
import { TimeZone } from '../types';
import { dateTime } from '../datetime';

interface ValueFormatTest {
  id: string;
  decimals?: DecimalCount;
  scaledDecimals?: DecimalCount;
  timeZone?: TimeZone;
  value: number;
  result: string;
}

const formatTests: ValueFormatTest[] = [
  // Currency
  { id: 'currencyUSD', decimals: 2, value: 1532.82, result: '$1.53K' },
  { id: 'currencyKRW', decimals: 2, value: 1532.82, result: '₩1.53K' },

  // Standard
  { id: 'ms', decimals: 4, value: 0.0024, result: '0.0024 ms' },
  { id: 'ms', decimals: 0, value: 100, result: '100 ms' },
  { id: 'ms', decimals: 2, value: 1250, result: '1.25 s' },
  { id: 'ms', decimals: 1, value: 10000086.123, result: '2.8 hour' },
  { id: 'ms', decimals: 0, value: 1200, result: '1 s' },
  { id: 'short', decimals: 0, scaledDecimals: -1, value: 98765, result: '98.77 K' },
  { id: 'short', decimals: 0, scaledDecimals: 0, value: 9876543, result: '9.876543 Mil' },
  { id: 'short', decimals: 2, scaledDecimals: null, value: 9876543, result: '9.88 Mil' },
  { id: 'kbytes', decimals: 3, value: 10000000, result: '9.537 GiB' },
  { id: 'deckbytes', decimals: 3, value: 10000000, result: '10.000 GB' },
  { id: 'megwatt', decimals: 3, value: 1000, result: '1.000 GW' },
  { id: 'kohm', decimals: 3, value: 1000, result: '1.000 MΩ' },
  { id: 'Mohm', decimals: 3, value: 1000, result: '1.000 GΩ' },

  { id: 'farad', decimals: 3, value: 1000, result: '1.000 kF' },
  { id: 'µfarad', decimals: 3, value: 1000, result: '1.000 mF' },
  { id: 'nfarad', decimals: 3, value: 1000, result: '1.000 µF' },
  { id: 'pfarad', decimals: 3, value: 1000, result: '1.000 nF' },
  { id: 'ffarad', decimals: 3, value: 1000, result: '1.000 pF' },

  { id: 'henry', decimals: 3, value: 1000, result: '1.000 kH' },
  { id: 'mhenry', decimals: 3, value: 1000, result: '1.000 H' },
  { id: 'µhenry', decimals: 3, value: 1000, result: '1.000 mH' },

  // Suffix (unknown units append to the end)
  { id: 'a', decimals: 0, value: 1532.82, result: '1533 a' },
  { id: 'b', decimals: 0, value: 1532.82, result: '1533 b' },

  // Prefix (unknown units append to the end)
  { id: 'prefix:b', value: 1532.82, result: 'b1533' },
  { id: 'suffix:d', value: 1532.82, result: '1533 d' },

  // SI Units
  { id: 'si:µF', value: 1234, decimals: 2, result: '1.23 mF' },
  { id: 'si:µF', value: 1234000000, decimals: 2, result: '1.23 kF' },
  { id: 'si:µF', value: 1234000000000000, decimals: 2, result: '1.23 GF' },

  // Counts (suffix)
  { id: 'count:xpm', value: 1234567, decimals: 2, result: '1.23M xpm' },
  { id: 'count:x/min', value: 1234, decimals: 2, result: '1.23K x/min' },

  // Currency (prefix)
  { id: 'currency:@', value: 1234567, decimals: 2, result: '@1.23M' },
  { id: 'currency:@', value: 1234, decimals: 2, result: '@1.23K' },

  // Time format
  { id: 'time:YYYY', decimals: 0, value: dateTime(new Date(1999, 6, 2)).valueOf(), result: '1999' },
  { id: 'time:YYYY.MM', decimals: 0, value: dateTime(new Date(2010, 6, 2)).valueOf(), result: '2010.07' },
  { id: 'dateTimeAsIso', decimals: 0, value: dateTime(new Date(2010, 6, 2)).valueOf(), result: '2010-07-02 00:00:00' },
  {
    id: 'dateTimeAsUS',
    decimals: 0,
    value: dateTime(new Date(2010, 6, 2)).valueOf(),
    result: '07/02/2010 12:00:00 am',
  },
  {
    id: 'dateTimeAsSystem',
    decimals: 0,
    value: dateTime(new Date(2010, 6, 2)).valueOf(),
    result: '2010-07-02 00:00:00',
  },
];

describe('valueFormats', () => {
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

  for (const test of formatTests) {
    describe(`value format: ${test.id}`, () => {
      it(`should translate ${test.value} as ${test.result}`, () => {
        const result = getValueFormat(test.id)(test.value, test.decimals, test.scaledDecimals);
        const full = formattedValueToString(result);
        expect(full).toBe(test.result);
      });
    });
  }

  describe('normal cases', () => {
    it('toFixed should handle number correctly if decimal is null', () => {
      expect(toFixed(100)).toBe('100');

      expect(toFixed(100.4)).toBe('100');
      expect(toFixed(100.5)).toBe('101');
    });

    it('toFixed should handle number correctly if decimal is not null', () => {
      expect(toFixed(100, 1)).toBe('100.0');

      expect(toFixed(100.37, 1)).toBe('100.4');
      expect(toFixed(100.63, 1)).toBe('100.6');

      expect(toFixed(100.4, 2)).toBe('100.40');
      expect(toFixed(100.5, 2)).toBe('100.50');
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
