define([
  'app/core/time_series'
], function(TimeSeries) {
  'use strict';

  describe("TimeSeries", function() {
    var points, series;
    var yAxisFormats = ['short', 'ms'];
    var testData = {
      alias: 'test',
      datapoints: [
        [1,2],[null,3],[10,4],[8,5]
      ]
    };

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
