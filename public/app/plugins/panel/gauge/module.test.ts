import { gaugePanelTypeChangedHook } from './module';

describe('Gauge Module', () => {
  describe('migrations', () => {
    it('should migrate from 6.0 settings to 6.1', () => {
      const v60 = {
        minValue: 50,
        maxValue: 60,
        showThresholdMarkers: true,
        showThresholdLabels: false,
        valueOptions: {
          prefix: 'a',
          suffix: 'z',
          decimals: 4,
          stat: 'avg',
          unit: 'ms',
        },
        valueMappings: [],
        thresholds: [{ index: 0, value: -Infinity, color: 'green' }, { index: 1, value: 80, color: 'red' }],
      };

      const after = gaugePanelTypeChangedHook(v60);
      expect((after.stat = 'avg'));
      expect(after).toMatchSnapshot();
    });
  });
});
