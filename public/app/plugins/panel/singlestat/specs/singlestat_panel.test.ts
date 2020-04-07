import { getColorForValue } from '../module';

describe('grafanaSingleStat', () => {
  describe('legacy thresholds', () => {
    describe('positive thresholds', () => {
      const data: any = {
        colorMap: ['green', 'yellow', 'red'],
        thresholds: [20, 50],
      };

      it('5 should return green', () => {
        expect(getColorForValue(data, 5)).toBe('green');
      });

      it('19.9 should return green', () => {
        expect(getColorForValue(data, 19.9)).toBe('green');
      });

      it('20 should return yellow', () => {
        expect(getColorForValue(data, 20)).toBe('yellow');
      });

      it('20.1 should return yellow', () => {
        expect(getColorForValue(data, 20.1)).toBe('yellow');
      });

      it('25 should return yellow', () => {
        expect(getColorForValue(data, 25)).toBe('yellow');
      });

      it('50 should return red', () => {
        expect(getColorForValue(data, 50)).toBe('red');
      });

      it('55 should return red', () => {
        expect(getColorForValue(data, 55)).toBe('red');
      });
    });
  });

  describe('negative thresholds', () => {
    const data: any = {
      colorMap: ['green', 'yellow', 'red'],
      thresholds: [0, 20],
    };

    it('-30 should return green', () => {
      expect(getColorForValue(data, -30)).toBe('green');
    });

    it('1 should return green', () => {
      expect(getColorForValue(data, 1)).toBe('yellow');
    });

    it('22 should return green', () => {
      expect(getColorForValue(data, 22)).toBe('red');
    });
  });

  describe('negative thresholds', () => {
    const data: any = {
      colorMap: ['green', 'yellow', 'red'],
      thresholds: [-27, 20],
    };

    it('-30 should return green', () => {
      expect(getColorForValue(data, -26)).toBe('yellow');
    });
  });
});
