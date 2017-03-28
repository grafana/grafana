///<reference path="../../../../headers/common.d.ts" />

import { describe, beforeEach, it, sinon, expect, angularMocks } from '../../../../../test/lib/common';

import '../module';
import angular from 'angular';
import $ from 'jquery';
import _ from 'lodash';
import helpers from 'test/specs/helpers';
import TimeSeries from 'app/core/time_series2';
import moment from 'moment';
import { Emitter } from 'app/core/core';
import rendering from '../rendering';
import { convertToHeatMap } from '../heatmap_data_converter';
// import d3 from 'd3';

describe('grafanaHeatmap', function () {

  beforeEach(angularMocks.module('grafana.core'));

  function heatmapScenario(desc, func, elementWidth = 500) {
    describe(desc, function () {
      var ctx: any = {};

      ctx.setup = function (setupFunc) {

        beforeEach(angularMocks.module(function ($provide) {
          $provide.value("timeSrv", new helpers.TimeSrvStub());
        }));

        beforeEach(angularMocks.inject(function ($rootScope, $compile) {
          var ctrl: any = {
            events: new Emitter(),
            height: 200,
            panel: {
              heatmap: {
              },
              cards: {
                cardPadding: null,
                cardRound: null
              },
              color: {
                mode: 'color',
                cardColor: '#b4ff00',
                colorScale: 'linear',
                exponent: 0.5,
                colorScheme: 'interpolateSpectral',
                fillBackground: false
              },
              xBucketSize: null,
              xBucketNumber: null,
              yBucketSize: null,
              yBucketNumber: null,
              xAxis: {
                show: true
              },
              yAxis: {
                show: true,
                format: 'short',
                decimals: null,
                logBase: 1,
                splitFactor: null,
                min: null,
                max: null,
                removeZeroValues: false
              },
              tooltip: {
                show: true,
                seriesStat: false,
                showHistogram: false
              },
              highlightCards: true
            },
            renderingCompleted: sinon.spy(),
            hiddenSeries: {},
            dashboard: {
              getTimezone: sinon.stub().returns('browser')
            },
            range: {
              from: moment(1422774000000),
              to:   moment(1422774100000),
            },
          };

          var scope = $rootScope.$new();
          scope.ctrl = ctrl;

          let series = [];
          series.push(new TimeSeries({
            datapoints: [[1422774000000, 1], [1422774060000, 2]],
            alias: 'series1'
          }));
          series.push(new TimeSeries({
            datapoints: [[1422774000000, 2], [1422774060000, 3]],
            alias: 'series2'
          }));

          setupFunc(ctrl, ctx.data);

          let xBucketSize = ctrl.panel.xBucketSize;
          let yBucketSize = ctrl.panel.yBucketSize;
          let logBase = ctrl.panel.yAxis.logBase;
          let bucketsData = convertToHeatMap(series, yBucketSize, xBucketSize, logBase);
          // console.log("bucketsData", bucketsData);

          ctx.data = {
            buckets: bucketsData,
            heatmapStats: {
              min: 1,
              max: 3,
              minLog: 1
            },
            xBucketSize: xBucketSize,
            yBucketSize: yBucketSize
          };

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
          let render = rendering(scope, $(element), [], ctrl);
          ctrl.events.emit('render');
        }));
      };

      func(ctx);
    });
  }

  heatmapScenario('default options', function (ctx) {
    ctx.setup(function (ctrl) {
      ctrl.panel.logBase = 1;
      ctrl.panel.xBucketSize = 1000;
      ctrl.panel.yBucketSize = 1;
    });

    it('should draw correct Y axis', function () {
      var yTicks = getTicks(ctx.element, ".axis-y");
      expect(yTicks).to.eql(['1', '2', '3']);
    });

    it('should draw correct X axis', function () {
      var xTicks = getTicks(ctx.element, ".axis-x");
      expect(xTicks).to.eql(['10:00:00', '10:00:15', '10:00:30', '10:00:45', '10:01:00', '10:01:15', '10:01:30']);
    });
  });

});


function getTicks(element, axisSelector) {
  return element.find(axisSelector).find("text")
    .map(function () {
      return this.textContent;
    }).get();
}
