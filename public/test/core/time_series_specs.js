define([
  'app/core/time_series'
], function(TimeSeries) {
  'use strict';

  describe("TimeSeries", function() {
    var points, series;
    var yAxisFormats = ['short', 'ms'];
    var testData;

    beforeEach(function() {
      testData = {
        alias: 'test',
        datapoints: [
          [1,2],[null,3],[10,4],[8,5]
        ]
      };
    });

    describe('when getting flot pairs', function() {
      it('with connected style, should ignore nulls', function() {
        series = new TimeSeries(testData);
        points = series.getFlotPairs('connected', yAxisFormats);
        expect(points.length).to.be(3);
      });

      it('with null as zero style, should replace nulls with zero', function() {
        series = new TimeSeries(testData);
        points = series.getFlotPairs('null as zero', yAxisFormats);
        expect(points.length).to.be(4);
        expect(points[1][1]).to.be(0);
      });

      it('if last is null current should pick next to last', function() {
        series = new TimeSeries({
          datapoints: [[10,1], [null, 2]]
        });
        series.getFlotPairs('null', yAxisFormats);
        expect(series.stats.current).to.be(10);
      });

      it('max value should work for negative values', function() {
        series = new TimeSeries({
          datapoints: [[-10,1], [-4, 2]]
        });
        series.getFlotPairs('null', yAxisFormats);
        expect(series.stats.max).to.be(-4);
      });

      it('average value should ignore nulls', function() {
        series = new TimeSeries(testData);
        series.getFlotPairs('null', yAxisFormats);
        expect(series.stats.avg).to.be(6.333333333333333);
      });

      it('the delta value should account for nulls', function() {
        series = new TimeSeries({
          datapoints: [[1,2],[3,3],[null,4],[10,5],[15,6]]
        });
        series.getFlotPairs('null', yAxisFormats);
        expect(series.stats.delta).to.be(14);
      });

      it('the delta value should account for nulls on first', function() {
        series = new TimeSeries({
          datapoints: [[null,2],[1,3],[10,4],[15,5]]
        });
        series.getFlotPairs('null', yAxisFormats);
        expect(series.stats.delta).to.be(14);
      });

      it('the delta value should account for nulls on last', function() {
        series = new TimeSeries({
          datapoints: [[1,2],[5,3],[10,4],[null,5]]
        });
        series.getFlotPairs('null', yAxisFormats);
        expect(series.stats.delta).to.be(9);
      });

      it('the delta value should account for resets', function() {
        series = new TimeSeries({
          datapoints: [[1,2],[5,3],[10,4],[0,5],[10,6]]
        });
        series.getFlotPairs('null', yAxisFormats);
        expect(series.stats.delta).to.be(19);
      });

      it('the delta value should account for resets on last', function() {
        series = new TimeSeries({
          datapoints: [[1,2],[2,3],[10,4],[8,5]]
        });
        series.getFlotPairs('null', yAxisFormats);
        expect(series.stats.delta).to.be(17);
      });

      it('the range value should be max - min', function() {
        series = new TimeSeries(testData);
        series.getFlotPairs('null', yAxisFormats);
        expect(series.stats.range).to.be(9);
      });

      it('first value should ingone nulls', function() {
        series = new TimeSeries(testData);
        series.getFlotPairs('null', yAxisFormats);
        expect(series.stats.first).to.be(1);
        series = new TimeSeries({
                 datapoints: [[null,2],[1,3],[10,4],[8,5]]
               });
        series.getFlotPairs('null', yAxisFormats);
        expect(series.stats.first).to.be(1);
      });

      it('with null as zero style, average value should treat nulls as 0', function() {
        series = new TimeSeries(testData);
        series.getFlotPairs('null as zero', yAxisFormats);
        expect(series.stats.avg).to.be(4.75);
      });
    });

    describe('When checking if ms resolution is needed', function() {
      describe('msResolution with second resolution timestamps', function() {
        beforeEach(function() {
          series = new TimeSeries({datapoints: [[45, 1234567890], [60, 1234567899]]});
        });

        it('should set hasMsResolution to false', function() {
          expect(series.hasMsResolution).to.be(false);
        });
      });

      describe('msResolution with millisecond resolution timestamps', function() {
        beforeEach(function() {
          series = new TimeSeries({datapoints: [[55, 1236547890001], [90, 1234456709000]]});
        });

        it('should show millisecond resolution tooltip', function() {
          expect(series.hasMsResolution).to.be(true);
        });
      });

      describe('msResolution with millisecond resolution timestamps but with trailing zeroes', function() {
        beforeEach(function() {
          series = new TimeSeries({datapoints: [[45, 1234567890000], [60, 1234567899000]]});
        });

        it('should not show millisecond resolution tooltip', function() {
          expect(series.hasMsResolution).to.be(false);
        });
      });
    });

    describe('can detect if series contains ms precision', function() {
      var fakedata;

      beforeEach(function() {
        fakedata = testData;
      });

      it('missing datapoint with ms precision', function() {
        fakedata.datapoints[0] = [1337, 1234567890000];
        series = new TimeSeries(fakedata);
        expect(series.isMsResolutionNeeded()).to.be(false);
      });

      it('contains datapoint with ms precision', function() {
        fakedata.datapoints[0] = [1337, 1236547890001];
        series = new TimeSeries(fakedata);
        expect(series.isMsResolutionNeeded()).to.be(true);
      });
    });

    describe('series overrides', function() {
      var series;
      beforeEach(function() {
        series = new TimeSeries(testData);
      });

      describe('fill & points', function() {
        beforeEach(function() {
          series.alias = 'test';
          series.applySeriesOverrides([{ alias: 'test', fill: 0, points: true }]);
        });

        it('should set fill zero, and enable points', function() {
          expect(series.lines.fill).to.be(0.001);
          expect(series.points.show).to.be(true);
        });
      });

      describe('series option overrides, bars, true & lines false', function() {
        beforeEach(function() {
          series.alias = 'test';
          series.applySeriesOverrides([{ alias: 'test', bars: true, lines: false }]);
        });

        it('should disable lines, and enable bars', function() {
          expect(series.lines.show).to.be(false);
          expect(series.bars.show).to.be(true);
        });
      });

      describe('series option overrides, linewidth, stack', function() {
        beforeEach(function() {
          series.alias = 'test';
          series.applySeriesOverrides([{ alias: 'test', linewidth: 5, stack: false }]);
        });

        it('should disable stack, and set lineWidth', function() {
          expect(series.stack).to.be(false);
          expect(series.lines.lineWidth).to.be(5);
        });
      });

      describe('series option overrides, dashes and lineWidth', function() {
        beforeEach(function() {
          series.alias = 'test';
          series.applySeriesOverrides([{ alias: 'test', linewidth: 5, dashes: true }]);
        });

        it('should enable dashes, set dashes lineWidth to 5 and lines lineWidth to 0', function() {
          expect(series.dashes.show).to.be(true);
          expect(series.dashes.lineWidth).to.be(5);
          expect(series.lines.lineWidth).to.be(0);
        });
      });

      describe('series option overrides, fill below to', function() {
        beforeEach(function() {
          series.alias = 'test';
          series.applySeriesOverrides([{ alias: 'test', fillBelowTo: 'min' }]);
        });

        it('should disable line fill and add fillBelowTo', function() {
          expect(series.fillBelowTo).to.be('min');
        });
      });

      describe('series option overrides, pointradius, steppedLine', function() {
        beforeEach(function() {
          series.alias = 'test';
          series.applySeriesOverrides([{ alias: 'test', pointradius: 5, steppedLine: true }]);
        });

        it('should set pointradius, and set steppedLine', function() {
          expect(series.points.radius).to.be(5);
          expect(series.lines.steps).to.be(true);
        });
      });

      describe('override match on regex', function() {
        beforeEach(function() {
          series.alias = 'test_01';
          series.applySeriesOverrides([{ alias: '/.*01/', lines: false }]);
        });

        it('should match second series', function() {
          expect(series.lines.show).to.be(false);
        });
      });

      describe('override series y-axis, and z-index', function() {
        beforeEach(function() {
          series.alias = 'test';
          series.applySeriesOverrides([{ alias: 'test', yaxis: 2, zindex: 2 }]);
        });

        it('should set yaxis', function() {
          expect(series.yaxis).to.be(2);
        });

        it('should set zindex', function() {
          expect(series.zindex).to.be(2);
        });
      });

    });
  });
});
