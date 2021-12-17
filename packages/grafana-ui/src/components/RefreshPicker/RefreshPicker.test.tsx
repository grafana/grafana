import { intervalsToOptions } from './RefreshPicker';

describe('RefreshPicker', () => {
  describe('intervalsToOptions', () => {
    describe('when called without intervals', () => {
      it('then default options should be used', () => {
        const result = intervalsToOptions();

        expect(result).toEqual([
          { value: '', label: 'Off', ariaLabel: 'Turn off auto refresh' },
          { value: '5s', label: '5s', ariaLabel: '5 seconds' },
          { value: '10s', label: '10s', ariaLabel: '10 seconds' },
          { value: '30s', label: '30s', ariaLabel: '30 seconds' },
          { value: '1m', label: '1m', ariaLabel: '1 minute' },
          { value: '5m', label: '5m', ariaLabel: '5 minutes' },
          { value: '15m', label: '15m', ariaLabel: '15 minutes' },
          { value: '30m', label: '30m', ariaLabel: '30 minutes' },
          { value: '1h', label: '1h', ariaLabel: '1 hour' },
          { value: '2h', label: '2h', ariaLabel: '2 hours' },
          { value: '1d', label: '1d', ariaLabel: '1 day' },
        ]);
      });
    });

    describe('when called with intervals', () => {
      it('then the resulting options should be correct', () => {
        const intervals = ['5s', '10s'];

        const result = intervalsToOptions({ intervals });

        expect(result).toEqual([
          { value: '', label: 'Off', ariaLabel: 'Turn off auto refresh' },
          { value: '5s', label: '5s', ariaLabel: '5 seconds' },
          { value: '10s', label: '10s', ariaLabel: '10 seconds' },
        ]);
      });
    });

    it('should format durations with multiple units', () => {
      const intervals = ['10s', '1m 30s'];

      const result = intervalsToOptions({ intervals });
      expect(result).toEqual([
        { value: '', label: 'Off', ariaLabel: 'Turn off auto refresh' },
        { value: '10s', label: '10s', ariaLabel: '10 seconds' },
        { value: '1m 30s', label: '1m 30s', ariaLabel: '1 minute 30 seconds' },
      ]);
    });
  });
});
