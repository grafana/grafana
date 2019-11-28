import { toFixed, getValueFormat, scaledUnits } from './valueFormats';
import { DecimalCount } from '../types/DisplayValue';
import { TimeZone } from '../types';

interface ValueFormatTest {
  id: string;
  decimals?: DecimalCount;
  scaledDecimals?: DecimalCount;
  timeZone?: TimeZone;
  value: number;
  result: string;
}

const formatTests: ValueFormatTest[] = [
  { id: 'ms', decimals: 4, value: 0.0024, result: '0.0024 ms' },
  { id: 'ms', decimals: 0, value: 100, result: '100 ms' },
  { id: 'ms', decimals: 2, value: 1250, result: '1.25 s' },
  { id: 'ms', decimals: 1, value: 10000086.123, result: '2.8 hour' },
  { id: 'ms', decimals: 0, value: 1200, result: '1 s' },
  { id: 'short', decimals: 0, scaledDecimals: -1, value: 98765, result: '98.77 K' },
  { id: 'short', decimals: 0, scaledDecimals: 0, value: 9876543, result: '9.876543 Mil' },
  { id: 'kbytes', decimals: 3, value: 10000000, result: '9.537 GiB' },
  { id: 'deckbytes', decimals: 3, value: 10000000, result: '10.000 GB' },

  // describe('megawatt format when scaled decimals is null do not use it', () => {
  //   it('should use specified decimals', () => {
  //     const str = getValueFormat('megwatt')(1000, 3, null);
  //     expect(str).toBe('1.000 GW');
  //   });
  // });
  //
  // describe('kiloohm format when scaled decimals is null do not use it', () => {
  //   it('should use specified decimals', () => {
  //     const str = getValueFormat('kohm')(1000, 3, null);
  //     expect(str).toBe('1.000 MΩ');
  //   });
  // });
  //
  // describe('megaohm format when scaled decimals is null do not use it', () => {
  //   it('should use specified decimals', () => {
  //     const str = getValueFormat('Mohm')(1000, 3, null);
  //     expect(str).toBe('1.000 GΩ');
  //   });
  // });
  //
  // describe('farad format when scaled decimals is null do not use it', () => {
  //   it('should use specified decimals', () => {
  //     const str = getValueFormat('farad')(1000, 3, null);
  //     expect(str).toBe('1.000 kF');
  //   });
  // });
  //
  // describe('microfarad format when scaled decimals is null do not use it', () => {
  //   it('should use specified decimals', () => {
  //     const str = getValueFormat('µfarad')(1000, 3, null);
  //     expect(str).toBe('1.000 mF');
  //   });
  // });
  //
  // describe('nanofarad format when scaled decimals is null do not use it', () => {
  //   it('should use specified decimals', () => {
  //     const str = getValueFormat('nfarad')(1000, 3, null);
  //     expect(str).toBe('1.000 µF');
  //   });
  // });
  //
  // describe('picofarad format when scaled decimals is null do not use it', () => {
  //   it('should use specified decimals', () => {
  //     const str = getValueFormat('pfarad')(1000, 3, null);
  //     expect(str).toBe('1.000 nF');
  //   });
  // });
  //
  // describe('femtofarad format when scaled decimals is null do not use it', () => {
  //   it('should use specified decimals', () => {
  //     const str = getValueFormat('ffarad')(1000, 3, null);
  //     expect(str).toBe('1.000 pF');
  //   });
  // });
  //
  // describe('henry format when scaled decimals is null do not use it', () => {
  //   it('should use specified decimals', () => {
  //     const str = getValueFormat('henry')(1000, 3, null);
  //     expect(str).toBe('1.000 kH');
  //   });
  // });
  //
  //  describe('millihenry format when scaled decimals is null do not use it', () => {
  //     it('should use specified decimals', () => {
  //       const str = getValueFormat('mhenry')(1000, 3, null);
  //       expect(str).toBe('1.000 H');
  //     });
  //   });
  //
  //   describe('microhenry format when scaled decimals is null do not use it', () => {
  //     it('should use specified decimals', () => {
  //       const str = getValueFormat('µhenry')(1000, 3, null);
  //       expect(str).toBe('1.000 mH');
  //     });
  //   });
];

describe('valueFormats', () => {
  for (const test of formatTests) {
    describe(`value format: ${test.id}`, () => {
      it(`should translate ${test.value} as ${test.result}`, () => {
        const result = getValueFormat(test.id)(test.value, test.decimals, test.scaledDecimals);
        const full = `${result.prefix ?? ''}${result.text}${result.suffix ?? ''}`;
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
});
