import TimeSeries from 'app/core/time_series2';
import { updateLegendValues } from 'app/core/time_series2';

describe('TimeSeries', () => {
  let points, series: any;
  const yAxisFormats = ['short', 'ms'];
  let testData: { alias?: string; datapoints: any };

  beforeEach(() => {
    testData = {
      alias: 'test',
      datapoints: [[1, 2], [null, 3], [10, 4], [8, 5]],
    };
  });

  describe('when getting flot pairs', () => {
    it('with connected style, should ignore nulls', () => {
      series = new TimeSeries(testData);
      points = series.getFlotPairs('connected', yAxisFormats);
      expect(points.length).toBe(3);
    });

    it('with null as zero style, should replace nulls with zero', () => {
      series = new TimeSeries(testData);
      points = series.getFlotPairs('null as zero', yAxisFormats);
      expect(points.length).toBe(4);
      expect(points[1][1]).toBe(0);
    });

    it('if last is null current should pick next to last', () => {
      series = new TimeSeries({
        datapoints: [[10, 1], [null, 2]],
      });
      series.getFlotPairs('null', yAxisFormats);
      expect(series.stats.current).toBe(10);
    });

    it('max value should work for negative values', () => {
      series = new TimeSeries({
        datapoints: [[-10, 1], [-4, 2]],
      });
      series.getFlotPairs('null', yAxisFormats);
      expect(series.stats.max).toBe(-4);
    });

    it('average value should ignore nulls', () => {
      series = new TimeSeries(testData);
      series.getFlotPairs('null', yAxisFormats);
      expect(series.stats.avg).toBe(6.333333333333333);
    });

    it('the delta value should account for nulls', () => {
      series = new TimeSeries({
        datapoints: [[1, 2], [3, 3], [null, 4], [10, 5], [15, 6]],
      });
      series.getFlotPairs('null', yAxisFormats);
      expect(series.stats.delta).toBe(14);
    });

    it('the delta value should account for nulls on first', () => {
      series = new TimeSeries({
        datapoints: [[null, 2], [1, 3], [10, 4], [15, 5]],
      });
      series.getFlotPairs('null', yAxisFormats);
      expect(series.stats.delta).toBe(14);
    });

    it('the delta value should account for nulls on last', () => {
      series = new TimeSeries({
        datapoints: [[1, 2], [5, 3], [10, 4], [null, 5]],
      });
      series.getFlotPairs('null', yAxisFormats);
      expect(series.stats.delta).toBe(9);
    });

    it('the delta value should account for resets', () => {
      series = new TimeSeries({
        datapoints: [[1, 2], [5, 3], [10, 4], [0, 5], [10, 6]],
      });
      series.getFlotPairs('null', yAxisFormats);
      expect(series.stats.delta).toBe(19);
    });

    it('the delta value should account for resets on last', () => {
      series = new TimeSeries({
        datapoints: [[1, 2], [2, 3], [10, 4], [8, 5]],
      });
      series.getFlotPairs('null', yAxisFormats);
      expect(series.stats.delta).toBe(17);
    });

    it('the range value should be max - min', () => {
      series = new TimeSeries(testData);
      series.getFlotPairs('null', yAxisFormats);
      expect(series.stats.range).toBe(9);
    });

    it('first value should ingone nulls', () => {
      series = new TimeSeries(testData);
      series.getFlotPairs('null', yAxisFormats);
      expect(series.stats.first).toBe(1);
      series = new TimeSeries({
        datapoints: [[null, 2], [1, 3], [10, 4], [8, 5]],
      });
      series.getFlotPairs('null', yAxisFormats);
      expect(series.stats.first).toBe(1);
    });

    it('with null as zero style, average value should treat nulls as 0', () => {
      series = new TimeSeries(testData);
      series.getFlotPairs('null as zero', yAxisFormats);
      expect(series.stats.avg).toBe(4.75);
    });

    it('average value should be null if all values is null', () => {
      series = new TimeSeries({
        datapoints: [[null, 2], [null, 3], [null, 4], [null, 5]],
      });
      series.getFlotPairs('null');
      expect(series.stats.avg).toBe(null);
    });

    it('calculates timeStep', () => {
      series = new TimeSeries({
        datapoints: [[null, 1], [null, 2], [null, 3]],
      });
      series.getFlotPairs('null');
      expect(series.stats.timeStep).toBe(1);

      series = new TimeSeries({
        datapoints: [[0, 1530529290], [0, 1530529305], [0, 1530529320]],
      });
      series.getFlotPairs('null');
      expect(series.stats.timeStep).toBe(15);
    });
  });

  describe('When checking if ms resolution is needed', () => {
    describe('msResolution with second resolution timestamps', () => {
      beforeEach(() => {
        series = new TimeSeries({
          datapoints: [[45, 1234567890], [60, 1234567899]],
        });
      });

      it('should set hasMsResolution to false', () => {
        expect(series.hasMsResolution).toBe(false);
      });
    });

    describe('msResolution with millisecond resolution timestamps', () => {
      beforeEach(() => {
        series = new TimeSeries({
          datapoints: [[55, 1236547890001], [90, 1234456709000]],
        });
      });

      it('should show millisecond resolution tooltip', () => {
        expect(series.hasMsResolution).toBe(true);
      });
    });

    describe('msResolution with millisecond resolution timestamps but with trailing zeroes', () => {
      beforeEach(() => {
        series = new TimeSeries({
          datapoints: [[45, 1234567890000], [60, 1234567899000]],
        });
      });

      it('should not show millisecond resolution tooltip', () => {
        expect(series.hasMsResolution).toBe(false);
      });
    });
  });

  describe('can detect if series contains ms precision', () => {
    let fakedata: any;

    beforeEach(() => {
      fakedata = testData;
    });

    it('missing datapoint with ms precision', () => {
      fakedata.datapoints[0] = [1337, 1234567890000];
      series = new TimeSeries(fakedata);
      expect(series.isMsResolutionNeeded()).toBe(false);
    });

    it('contains datapoint with ms precision', () => {
      fakedata.datapoints[0] = [1337, 1236547890001];
      series = new TimeSeries(fakedata);
      expect(series.isMsResolutionNeeded()).toBe(true);
    });
  });

  describe('series overrides', () => {
    let series: any;
    beforeEach(() => {
      series = new TimeSeries(testData);
    });

    describe('fill & points', () => {
      beforeEach(() => {
        series.alias = 'test';
        series.applySeriesOverrides([{ alias: 'test', fill: 0, points: true }]);
      });

      it('should set fill zero, and enable points', () => {
        expect(series.lines.fill).toBe(0.001);
        expect(series.points.show).toBe(true);
      });
    });

    describe('series option overrides, bars, true & lines false', () => {
      beforeEach(() => {
        series.alias = 'test';
        series.applySeriesOverrides([{ alias: 'test', bars: true, lines: false }]);
      });

      it('should disable lines, and enable bars', () => {
        expect(series.lines.show).toBe(false);
        expect(series.bars.show).toBe(true);
      });
    });

    describe('series option overrides, linewidth, stack', () => {
      beforeEach(() => {
        series.alias = 'test';
        series.applySeriesOverrides([{ alias: 'test', linewidth: 5, stack: false }]);
      });

      it('should disable stack, and set lineWidth', () => {
        expect(series.stack).toBe(false);
        expect(series.lines.lineWidth).toBe(5);
      });
    });

    describe('series option overrides, dashes and lineWidth', () => {
      beforeEach(() => {
        series.alias = 'test';
        series.applySeriesOverrides([{ alias: 'test', linewidth: 5, dashes: true }]);
      });

      it('should enable dashes, set dashes lineWidth to 5 and lines lineWidth to 0', () => {
        expect(series.dashes.show).toBe(true);
        expect(series.dashes.lineWidth).toBe(5);
        expect(series.lines.lineWidth).toBe(0);
      });
    });

    describe('series option overrides, fill below to', () => {
      beforeEach(() => {
        series.alias = 'test';
        series.applySeriesOverrides([{ alias: 'test', fillBelowTo: 'min' }]);
      });

      it('should disable line fill and add fillBelowTo', () => {
        expect(series.fillBelowTo).toBe('min');
      });
    });

    describe('series option overrides, pointradius, steppedLine', () => {
      beforeEach(() => {
        series.alias = 'test';
        series.applySeriesOverrides([{ alias: 'test', pointradius: 5, steppedLine: true }]);
      });

      it('should set pointradius, and set steppedLine', () => {
        expect(series.points.radius).toBe(5);
        expect(series.lines.steps).toBe(true);
      });
    });

    describe('override match on regex', () => {
      beforeEach(() => {
        series.alias = 'test_01';
        series.applySeriesOverrides([{ alias: '/.*01/', lines: false }]);
      });

      it('should match second series', () => {
        expect(series.lines.show).toBe(false);
      });
    });

    describe('override series y-axis, and z-index', () => {
      beforeEach(() => {
        series.alias = 'test';
        series.applySeriesOverrides([{ alias: 'test', yaxis: 2, zindex: 2 }]);
      });

      it('should set yaxis', () => {
        expect(series.yaxis).toBe(2);
      });

      it('should set zindex', () => {
        expect(series.zindex).toBe(2);
      });
    });

    describe('override color', () => {
      beforeEach(() => {
        series.applySeriesOverrides([{ alias: 'test', color: '#112233' }]);
      });

      it('should set color', () => {
        expect(series.color).toBe('#112233');
      });

      it('should set bars.fillColor', () => {
        expect(series.bars.fillColor).toBe('#112233');
      });
    });
  });

  describe('value formatter', () => {
    let series: any;
    beforeEach(() => {
      series = new TimeSeries(testData);
    });

    it('should format non-numeric values as empty string', () => {
      expect(series.formatValue(null)).toBe('');
      expect(series.formatValue(undefined)).toBe('');
      expect(series.formatValue(NaN)).toBe('');
      expect(series.formatValue(Infinity)).toBe('');
      expect(series.formatValue(-Infinity)).toBe('');
    });
  });

  describe('legend decimals', () => {
    let series: any, panel: any;
    const height = 200;
    beforeEach(() => {
      testData = {
        alias: 'test',
        datapoints: [[1, 2], [0, 3], [10, 4], [8, 5]],
      };
      series = new TimeSeries(testData);
      series.getFlotPairs();
      panel = {
        decimals: null,
        yaxes: [
          {
            decimals: null,
          },
        ],
      };
    });

    it('should set decimals based on Y axis (expect calculated decimals = 1)', () => {
      const data = [series];
      // Expect ticks with this data will have decimals = 1
      updateLegendValues(data, panel, height);
      expect(data[0].decimals).toBe(2);
    });

    it('should set decimals based on Y axis to 0 if calculated decimals = 0)', () => {
      testData.datapoints = [[10, 2], [0, 3], [100, 4], [80, 5]];
      series = new TimeSeries(testData);
      series.getFlotPairs();
      const data = [series];
      updateLegendValues(data, panel, height);
      expect(data[0].decimals).toBe(0);
    });

    it('should set decimals to Y axis decimals + 1', () => {
      panel.yaxes[0].decimals = 2;
      const data = [series];
      updateLegendValues(data, panel, height);
      expect(data[0].decimals).toBe(3);
    });

    it('should set decimals to legend decimals value if it was set explicitly', () => {
      panel.decimals = 3;
      const data = [series];
      updateLegendValues(data, panel, height);
      expect(data[0].decimals).toBe(3);
    });
  });
});
