///<reference path="../../../../headers/common.d.ts" />

import {describe, beforeEach, it, sinon, expect, angularMocks} from '../../../../../test/lib/common';

import '../module';
import angular from 'angular';
import $ from 'jquery';
import helpers from 'test/specs/helpers';
import TimeSeries from 'app/core/time_series2';
import moment from 'moment';
import {Emitter} from 'app/core/core';

describe('grafanaGraph', function() {

  beforeEach(angularMocks.module('grafana.directives'));

  function graphScenario(desc, func, elementWidth = 500)  {
    describe(desc, function() {
      var ctx: any = {};

      ctx.setup = function(setupFunc) {

        beforeEach(angularMocks.module(function($provide) {
          $provide.value("timeSrv", new helpers.TimeSrvStub());
        }));

        beforeEach(angularMocks.inject(function($rootScope, $compile) {
          var ctrl: any = {
            events: new Emitter(),
            height: 200,
            panel: {
              legend: {},
              grid: { },
              yaxes: [
                {
                  min: null,
                  max: null,
                  format: 'short',
                  logBase: 1
                },
                {
                  min: null,
                  max: null,
                  format: 'short',
                  logBase: 1
                }
              ],
              xaxis: {},
              seriesOverrides: [],
              tooltip: {
                shared: true
              }
            },
            renderingCompleted: sinon.spy(),
            hiddenSeries: {},
            dashboard: {
              getTimezone: sinon.stub().returns('browser')
            },
            range: {
              from: moment([2015, 1, 1, 10]),
              to: moment([2015, 1, 1, 22]),
            },
          };

          var scope = $rootScope.$new();
          scope.ctrl = ctrl;


          $rootScope.onAppEvent = sinon.spy();

          ctx.data = [];
          ctx.data.push(new TimeSeries({
            datapoints: [[1,1],[2,2]],
            alias: 'series1'
          }));
          ctx.data.push(new TimeSeries({
            datapoints: [[1,1],[2,2]],
            alias: 'series2'
          }));

          setupFunc(ctrl, ctx.data);

          var element = angular.element("<div style='width:" + elementWidth + "px' grafana-graph><div>");
          $compile(element)(scope);
          scope.$digest();

          $.plot = ctx.plotSpy = sinon.spy();
          ctrl.events.emit('render', ctx.data);
          ctx.plotData = ctx.plotSpy.getCall(0).args[1];
          ctx.plotOptions = ctx.plotSpy.getCall(0).args[2];
        }));
      };

      func(ctx);
    });
  }

  graphScenario('simple lines options', function(ctx) {
    ctx.setup(function(ctrl) {
      ctrl.panel.lines = true;
      ctrl.panel.fill = 5;
      ctrl.panel.linewidth = 3;
      ctrl.panel.steppedLine = true;
    });

    it('should configure plot with correct options', function() {
      expect(ctx.plotOptions.series.lines.show).to.be(true);
      expect(ctx.plotOptions.series.lines.fill).to.be(0.5);
      expect(ctx.plotOptions.series.lines.lineWidth).to.be(3);
      expect(ctx.plotOptions.series.lines.steps).to.be(true);
    });
  });

  graphScenario('grid thresholds 100, 200', function(ctx) {
    ctx.setup(function(ctrl) {
      ctrl.panel.grid = {
        threshold1: 100,
        threshold1Color: "#111",
        threshold2: 200,
        threshold2Color: "#222",
      };
    });

    it('should add grid markings', function() {
      var markings = ctx.plotOptions.grid.markings;
      expect(markings[0].yaxis.from).to.be(100);
      expect(markings[0].yaxis.to).to.be(200);
      expect(markings[0].color).to.be('#111');
      expect(markings[1].yaxis.from).to.be(200);
      expect(markings[1].yaxis.to).to.be(Infinity);
    });
  });

  graphScenario('inverted grid thresholds 200, 100', function(ctx) {
    ctx.setup(function(ctrl) {
      ctrl.panel.grid = {
        threshold1: 200,
        threshold1Color: "#111",
        threshold2: 100,
        threshold2Color: "#222",
      };
    });

    it('should add grid markings', function() {
      var markings = ctx.plotOptions.grid.markings;
      expect(markings[0].yaxis.from).to.be(200);
      expect(markings[0].yaxis.to).to.be(100);
      expect(markings[0].color).to.be('#111');
      expect(markings[1].yaxis.from).to.be(100);
      expect(markings[1].yaxis.to).to.be(-Infinity);
    });
  });

  graphScenario('grid thresholds from zero', function(ctx) {
    ctx.setup(function(ctrl) {
      ctrl.panel.grid = {
        threshold1: 0,
        threshold1Color: "#111",
      };
    });

    it('should add grid markings', function() {
      var markings = ctx.plotOptions.grid.markings;
      expect(markings[0].yaxis.from).to.be(0);
    });
  });

  graphScenario('when logBase is log 10', function(ctx) {
    ctx.setup(function(ctrl) {
      ctrl.panel.yaxes[0].logBase = 10;
    });

    it('should apply axis transform and ticks', function() {
      var axis = ctx.plotOptions.yaxes[0];
      expect(axis.transform(100)).to.be(Math.log(100+0.1));
      expect(axis.ticks[0]).to.be(0);
      expect(axis.ticks[1]).to.be(1);
    });
  });

  graphScenario('should use timeStep for barWidth', function(ctx) {
    ctx.setup(function(ctrl, data) {
      ctrl.panel.bars = true;
      data[0] = new TimeSeries({
        datapoints: [[1,10],[2,20]],
        alias: 'series1',
      });
    });

    it('should set barWidth', function() {
      expect(ctx.plotOptions.series.bars.barWidth).to.be(10/1.5);
    });
  });

  graphScenario('series option overrides, fill & points', function(ctx) {
    ctx.setup(function(ctrl, data) {
      ctrl.panel.lines = true;
      ctrl.panel.fill = 5;
      data[0].zindex = 10;
      data[1].alias = 'test';
      data[1].lines = {fill: 0.001};
      data[1].points = {show: true};
    });

    it('should match second series and fill zero, and enable points', function() {
      expect(ctx.plotOptions.series.lines.fill).to.be(0.5);
      expect(ctx.plotData[1].lines.fill).to.be(0.001);
      expect(ctx.plotData[1].points.show).to.be(true);
    });
  });

  graphScenario('should order series order according to zindex', function(ctx) {
    ctx.setup(function(ctrl, data) {
      data[1].zindex = 1;
      data[0].zindex = 10;
    });

    it('should move zindex 2 last', function() {
      expect(ctx.plotData[0].alias).to.be('series2');
      expect(ctx.plotData[1].alias).to.be('series1');
    });
  });

  graphScenario('when series is hidden', function(ctx) {
    ctx.setup(function(ctrl) {
      ctrl.hiddenSeries = {'series2': true};
    });

    it('should remove datapoints and disable stack', function() {
      expect(ctx.plotData[0].alias).to.be('series1');
      expect(ctx.plotData[1].data.length).to.be(0);
      expect(ctx.plotData[1].stack).to.be(false);
    });
  });

  graphScenario('when stack and percent', function(ctx) {
    ctx.setup(function(ctrl) {
      ctrl.panel.percentage = true;
      ctrl.panel.stack = true;
    });

    it('should show percentage', function() {
      var axis = ctx.plotOptions.yaxes[0];
      expect(axis.tickFormatter(100, axis)).to.be("100%");
    });
  });

  graphScenario('when panel too narrow to show x-axis dates in same granularity as wide panels', function(ctx) {
    describe('and the range is less than 24 hours', function() {
      ctx.setup(function(ctrl) {
        ctrl.range.from = moment([2015, 1, 1, 10]);
        ctrl.range.to = moment([2015, 1, 1, 22]);
      });

      it('should format dates as hours minutes', function() {
        var axis = ctx.plotOptions.xaxis;
        expect(axis.timeformat).to.be('%H:%M');
      });
    });

    describe('and the range is less than one year', function() {
      ctx.setup(function(scope) {
        scope.range.from = moment([2015, 1, 1]);
        scope.range.to = moment([2015, 11, 20]);
      });

      it('should format dates as month days', function() {
        var axis = ctx.plotOptions.xaxis;
        expect(axis.timeformat).to.be('%m/%d');
      });
    });

  }, 10);
});
