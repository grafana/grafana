import { intervalsToOptions } from './RefreshPicker';

describe('RefreshPicker', () => {
  describe('intervalsToOptions', () => {
    describe('when called without intervals', () => {
      it('then default options should be used', () => {
        const currentValue = '5s';

        const result = intervalsToOptions(currentValue);

        expect(result).toEqual([
          { value: '', label: 'Off' },
          { value: '5s', label: '5s' },
          { value: '10s', label: '10s' },
          { value: '30s', label: '30s' },
          { value: '1m', label: '1m' },
          { value: '5m', label: '5m' },
          { value: '15m', label: '15m' },
          { value: '30m', label: '30m' },
          { value: '1h', label: '1h' },
          { value: '2h', label: '2h' },
          { value: '1d', label: '1d' },
        ]);
      });
    });

    describe('when called with a currentValue that exist in intervals', () => {
      it('then the resulting options should be correct', () => {
        const intervals = ['5s', '10s'];
        const currentValue = '5s';

        const result = intervalsToOptions(currentValue, intervals);

        expect(result).toEqual([
          { value: '', label: 'Off' },
          { value: '5s', label: '5s' },
          { value: '10s', label: '10s' },
        ]);
      });
    });

    describe('when called with a valid currentValue that does not exist in intervals', () => {
      it('then the resulting options should be correct', () => {
        const intervals = ['5s', '10s'];
        const currentValue = '6s';

        const result = intervalsToOptions(currentValue, intervals);

        expect(result).toEqual([
          { value: '', label: 'Off' },
          { value: '5s', label: '5s' },
          { value: '6s', label: '6s' },
          { value: '10s', label: '10s' },
        ]);
      });
    });

    describe('when called with an invalid currentValue that does not exist in intervals', () => {
      it('then the resulting options should be correct', () => {
        const intervals = ['5s', '10s'];
        const currentValue = 'LIVE';

        const result = intervalsToOptions(currentValue, intervals);

        expect(result).toEqual([
          { value: '', label: 'Off' },
          { value: '5s', label: '5s' },
          { value: '10s', label: '10s' },
        ]);
      });
    });

    describe('when called with hasLiveOption', () => {
      it('then the resulting options should be correct', () => {
        const intervals = ['5s', '10s'];
        const currentValue = '5s';

        const result = intervalsToOptions(currentValue, intervals, true);

        expect(result).toEqual([
          { value: '', label: 'Off' },
          { value: 'LIVE', label: 'Live' },
          { value: '5s', label: '5s' },
          { value: '10s', label: '10s' },
        ]);
      });
    });
  });
});
