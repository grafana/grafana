import { describe, beforeEach, it, sinon, expect, angularMocks } from '../../../../../test/lib/common';

import '../module';
import angular from 'angular';
import $ from 'jquery';
import helpers from 'test/specs/helpers';
import TimeSeries from 'app/core/time_series2';
import moment from 'moment';
import { Emitter } from 'app/core/core';
import rendering from '../rendering';
import { convertToHeatMap, convertToCards, histogramToHeatmap, calculateBucketSize } from '../heatmap_data_converter';

describe('grafanaHeatmap', function() {
  beforeEach(angularMocks.module('grafana.core'));

  function heatmapScenario(desc, func, elementWidth = 500) {
    describe(desc, function() {
      var ctx: any = {};

      ctx.setup = function(setupFunc) {
        beforeEach(
          angularMocks.module(function($provide) {
            $provide.value('timeSrv', new helpers.TimeSrvStub());
          })
        );

        beforeEach(
          angularMocks.inject(function($rootScope, $compile) {
            var ctrl: any = {
              colorSchemes: [
                {
                  name: 'Oranges',
                  value: 'interpolateOranges',
                  invert: 'dark',
                },
                { name: 'Reds', value: 'interpolateReds', invert: 'dark' },
              ],
              events: new Emitter(),
              height: 200,
              panel: {
                heatmap: {},
                cards: {
                  cardPadding: null,
                  cardRound: null,
                },
                color: {
                  mode: 'spectrum',
                  cardColor: '#b4ff00',
                  colorScale: 'linear',
                  exponent: 0.5,
                  colorScheme: 'interpolateOranges',
                  fillBackground: false,
                },
                legend: {
                  show: false,
                },
                xBucketSize: 1000,
                xBucketNumber: null,
                yBucketSize: 1,
                yBucketNumber: null,
                xAxis: {
                  show: true,
                },
                yAxis: {
                  show: true,
                  format: 'short',
                  decimals: null,
                  logBase: 1,
                  splitFactor: null,
                  min: null,
                  max: null,
                  removeZeroValues: false,
                },
                tooltip: {
                  show: true,
                  seriesStat: false,
                  showHistogram: false,
                },
                highlightCards: true,
              },
              renderingCompleted: sinon.spy(),
              hiddenSeries: {},
              dashboard: {
                getTimezone: sinon.stub().returns('utc'),
              },
              range: {
                from: moment.utc('01 Mar 2017 10:00:00', 'DD MMM YYYY HH:mm:ss'),
                to: moment.utc('01 Mar 2017 11:00:00', 'DD MMM YYYY HH:mm:ss'),
              },
            };

            var scope = $rootScope.$new();
            scope.ctrl = ctrl;

            ctx.series = [];
            ctx.series.push(
              new TimeSeries({
                datapoints: [[1, 1422774000000], [2, 1422774060000]],
                alias: 'series1',
              })
            );
            ctx.series.push(
              new TimeSeries({
                datapoints: [[2, 1422774000000], [3, 1422774060000]],
                alias: 'series2',
              })
            );

            ctx.data = {
              heatmapStats: {
                min: 1,
                max: 3,
                minLog: 1,
              },
              xBucketSize: ctrl.panel.xBucketSize,
              yBucketSize: ctrl.panel.yBucketSize,
            };

            setupFunc(ctrl, ctx);

            let logBase = ctrl.panel.yAxis.logBase;
            let bucketsData;
            if (ctrl.panel.dataFormat === 'tsbuckets') {
              bucketsData = histogramToHeatmap(ctx.series);
            } else {
              bucketsData = convertToHeatMap(ctx.series, ctx.data.yBucketSize, ctx.data.xBucketSize, logBase);
            }
            ctx.data.buckets = bucketsData;

            let { cards, cardStats } = convertToCards(bucketsData);
            ctx.data.cards = cards;
            ctx.data.cardStats = cardStats;

            let elemHtml = `
          <div class="heatmap-wrapper">
            <div class="heatmap-canvas-wrapper">
              <div class="heatmap-panel" style='width:${elementWidth}px'></div>
            </div>
          </div>`;

            var element = angular.element(elemHtml);
            $compile(element)(scope);
            scope.$digest();

            ctrl.data = ctx.data;
            ctx.element = element;
            rendering(scope, $(element), [], ctrl);
            ctrl.events.emit('render');
          })
        );
      };

      func(ctx);
    });
  }

  heatmapScenario('default options', function(ctx) {
    ctx.setup(function(ctrl) {
      ctrl.panel.yAxis.logBase = 1;
    });

    it('should draw correct Y axis', function() {
      var yTicks = getTicks(ctx.element, '.axis-y');
      expect(yTicks).to.eql(['1', '2', '3']);
    });

    it('should draw correct X axis', function() {
      var xTicks = getTicks(ctx.element, '.axis-x');
      let expectedTicks = [
        formatTime('01 Mar 2017 10:00:00'),
        formatTime('01 Mar 2017 10:15:00'),
        formatTime('01 Mar 2017 10:30:00'),
        formatTime('01 Mar 2017 10:45:00'),
        formatTime('01 Mar 2017 11:00:00'),
      ];
      expect(xTicks).to.eql(expectedTicks);
    });
  });

  heatmapScenario('when logBase is 2', function(ctx) {
    ctx.setup(function(ctrl) {
      ctrl.panel.yAxis.logBase = 2;
    });

    it('should draw correct Y axis', function() {
      var yTicks = getTicks(ctx.element, '.axis-y');
      expect(yTicks).to.eql(['1', '2', '4']);
    });
  });

  heatmapScenario('when logBase is 10', function(ctx) {
    ctx.setup(function(ctrl, ctx) {
      ctrl.panel.yAxis.logBase = 10;

      ctx.series.push(
        new TimeSeries({
          datapoints: [[10, 1422774000000], [20, 1422774060000]],
          alias: 'series3',
        })
      );
      ctx.data.heatmapStats.max = 20;
    });

    it('should draw correct Y axis', function() {
      var yTicks = getTicks(ctx.element, '.axis-y');
      expect(yTicks).to.eql(['1', '10', '100']);
    });
  });

  heatmapScenario('when logBase is 32', function(ctx) {
    ctx.setup(function(ctrl) {
      ctrl.panel.yAxis.logBase = 32;

      ctx.series.push(
        new TimeSeries({
          datapoints: [[10, 1422774000000], [100, 1422774060000]],
          alias: 'series3',
        })
      );
      ctx.data.heatmapStats.max = 100;
    });

    it('should draw correct Y axis', function() {
      var yTicks = getTicks(ctx.element, '.axis-y');
      expect(yTicks).to.eql(['1', '32', '1.0 K']);
    });
  });

  heatmapScenario('when logBase is 1024', function(ctx) {
    ctx.setup(function(ctrl) {
      ctrl.panel.yAxis.logBase = 1024;

      ctx.series.push(
        new TimeSeries({
          datapoints: [[2000, 1422774000000], [300000, 1422774060000]],
          alias: 'series3',
        })
      );
      ctx.data.heatmapStats.max = 300000;
    });

    it('should draw correct Y axis', function() {
      var yTicks = getTicks(ctx.element, '.axis-y');
      expect(yTicks).to.eql(['1', '1 K', '1.0 Mil']);
    });
  });

  heatmapScenario('when Y axis format set to "none"', function(ctx) {
    ctx.setup(function(ctrl) {
      ctrl.panel.yAxis.logBase = 1;
      ctrl.panel.yAxis.format = 'none';
      ctx.data.heatmapStats.max = 10000;
    });

    it('should draw correct Y axis', function() {
      var yTicks = getTicks(ctx.element, '.axis-y');
      expect(yTicks).to.eql(['0', '2000', '4000', '6000', '8000', '10000', '12000']);
    });
  });

  heatmapScenario('when Y axis format set to "second"', function(ctx) {
    ctx.setup(function(ctrl) {
      ctrl.panel.yAxis.logBase = 1;
      ctrl.panel.yAxis.format = 's';
      ctx.data.heatmapStats.max = 3600;
    });

    it('should draw correct Y axis', function() {
      var yTicks = getTicks(ctx.element, '.axis-y');
      expect(yTicks).to.eql(['0 ns', '17 min', '33 min', '50 min', '1.11 hour']);
    });
  });

  heatmapScenario('when data format is Time series buckets', function(ctx) {
    ctx.setup(function(ctrl, ctx) {
      ctrl.panel.dataFormat = 'tsbuckets';

      const series = [
        {
          alias: '1',
          datapoints: [[1000, 1422774000000], [200000, 1422774060000]],
        },
        {
          alias: '2',
          datapoints: [[3000, 1422774000000], [400000, 1422774060000]],
        },
        {
          alias: '3',
          datapoints: [[2000, 1422774000000], [300000, 1422774060000]],
        },
      ];
      ctx.series = series.map(s => new TimeSeries(s));

      ctx.data.tsBuckets = series.map(s => s.alias).concat('');
      ctx.data.yBucketSize = 1;
      let xBucketBoundSet = series[0].datapoints.map(dp => dp[1]);
      ctx.data.xBucketSize = calculateBucketSize(xBucketBoundSet);
    });

    it('should draw correct Y axis', function() {
      var yTicks = getTicks(ctx.element, '.axis-y');
      expect(yTicks).to.eql(['1', '2', '3', '']);
    });
  });
});

function getTicks(element, axisSelector) {
  return element
    .find(axisSelector)
    .find('text')
    .map(function() {
      return this.textContent;
    })
    .get();
}

function formatTime(timeStr) {
  let format = 'HH:mm';
  return moment.utc(timeStr, 'DD MMM YYYY HH:mm:ss').format(format);
}
