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

  beforeEach(angularMocks.module('grafana.core'));

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
              thresholds: [],
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

  graphScenario('when logBase is log 10', function(ctx) {
    ctx.setup(function(ctrl, data) {
      ctrl.panel.yaxes[0].logBase = 10;
      data[0] = new TimeSeries({
        datapoints: [[2000,1],[0.002,2],[0,3],[-1,4]],
        alias: 'seriesAutoscale',
      });
      data[0].yaxis = 1;
      ctrl.panel.yaxes[1].logBase = 10;
      ctrl.panel.yaxes[1].min = '0.05';
      ctrl.panel.yaxes[1].max = '1500';
      data[1] = new TimeSeries({
        datapoints: [[2000,1],[0.002,2],[0,3],[-1,4]],
        alias: 'seriesFixedscale',
      });
      data[1].yaxis = 2;
    });

    it('should apply axis transform, autoscaling (if necessary) and ticks', function() {
      var axisAutoscale = ctx.plotOptions.yaxes[0];
      expect(axisAutoscale.transform(100)).to.be(2);
      expect(axisAutoscale.inverseTransform(-3)).to.be(0.001);
      expect(axisAutoscale.min).to.be(0.001);
      expect(axisAutoscale.max).to.be(10000);
      expect(axisAutoscale.ticks.length).to.be(8);
      expect(axisAutoscale.ticks[0]).to.be(0.001);
      expect(axisAutoscale.ticks[7]).to.be(10000);

      var axisFixedscale = ctx.plotOptions.yaxes[1];
      expect(axisFixedscale.min).to.be(0.05);
      expect(axisFixedscale.max).to.be(1500);
      expect(axisFixedscale.ticks.length).to.be(5);
      expect(axisFixedscale.ticks[0]).to.be(0.1);
      expect(axisFixedscale.ticks[4]).to.be(1000);
    });
  });

  graphScenario('when logBase is log 10 and data points contain only zeroes', function(ctx) {
    ctx.setup(function(ctrl, data) {
      ctrl.panel.yaxes[0].logBase = 10;
      data[0] = new TimeSeries({
        datapoints: [[0,1],[0,2],[0,3],[0,4]],
        alias: 'seriesAutoscale',
      });
      data[0].yaxis = 1;
    });

    it('should not set min and max and should create some fake ticks', function() {
      var axisAutoscale = ctx.plotOptions.yaxes[0];
      expect(axisAutoscale.transform(100)).to.be(2);
      expect(axisAutoscale.inverseTransform(-3)).to.be(0.001);
      expect(axisAutoscale.min).to.be(undefined);
      expect(axisAutoscale.max).to.be(undefined);
      expect(axisAutoscale.ticks.length).to.be(2);
      expect(axisAutoscale.ticks[0]).to.be(1);
      expect(axisAutoscale.ticks[1]).to.be(2);
    });
  });

  // y-min set 0 is a special case for log scale,
  // this approximates it by setting min to 0.1
  graphScenario('when logBase is log 10 and y-min is set to 0 and auto min is > 0.1', function(ctx) {
    ctx.setup(function(ctrl, data) {
      ctrl.panel.yaxes[0].logBase = 10;
      ctrl.panel.yaxes[0].min = '0';
      data[0] = new TimeSeries({
        datapoints: [[2000,1],[4 ,2],[500,3],[3000,4]],
        alias: 'seriesAutoscale',
      });
      data[0].yaxis = 1;
    });

    it('should set min to 0.1 and add a tick for 0.1', function() {
      var axisAutoscale = ctx.plotOptions.yaxes[0];
      expect(axisAutoscale.transform(100)).to.be(2);
      expect(axisAutoscale.inverseTransform(-3)).to.be(0.001);
      expect(axisAutoscale.min).to.be(0.1);
      expect(axisAutoscale.max).to.be(10000);
      expect(axisAutoscale.ticks.length).to.be(6);
      expect(axisAutoscale.ticks[0]).to.be(0.1);
      expect(axisAutoscale.ticks[5]).to.be(10000);
    });
  });

  graphScenario('when logBase is log 2 and y-min is set to 0 and num of ticks exceeds max', function(ctx) {
    ctx.setup(function(ctrl, data) {
      const heightForApprox5Ticks = 125;
      ctrl.height = heightForApprox5Ticks;
      ctrl.panel.yaxes[0].logBase = 2;
      ctrl.panel.yaxes[0].min = '0';
      data[0] = new TimeSeries({
        datapoints: [[2000,1],[4 ,2],[500,3],[3000,4], [10000,5], [100000,6]],
        alias: 'seriesAutoscale',
      });
      data[0].yaxis = 1;
    });

    it('should regenerate ticks so that if fits on the y-axis', function() {
      var axisAutoscale = ctx.plotOptions.yaxes[0];
      expect(axisAutoscale.min).to.be(0.1);
      expect(axisAutoscale.ticks.length).to.be(8);
      expect(axisAutoscale.ticks[0]).to.be(0.1);
      expect(axisAutoscale.ticks[7]).to.be(262144);
      expect(axisAutoscale.max).to.be(262144);
    });

    it('should set axis max to be max tick value', function() {
      expect(ctx.plotOptions.yaxes[0].max).to.be(262144);
    });
  });

  graphScenario('dashed lines options', function(ctx) {
    ctx.setup(function(ctrl) {
      ctrl.panel.lines = true;
      ctrl.panel.linewidth = 2;
      ctrl.panel.dashes = true;
    });

    it('should configure dashed plot with correct options', function() {
      expect(ctx.plotOptions.series.lines.show).to.be(true);
      expect(ctx.plotOptions.series.dashes.lineWidth).to.be(2);
      expect(ctx.plotOptions.series.dashes.show).to.be(true);
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
      expect(ctx.plotOptions.series.bars.barWidth).to.be(1/1.5);
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

  // graphScenario('when using flexible Y-Min and Y-Max settings', function(ctx) {
  //   describe('and Y-Min is <100 and Y-Max is >200 and values within range', function() {
  //     ctx.setup(function(ctrl, data) {
  //       ctrl.panel.yaxes[0].min = '<100';
  //       ctrl.panel.yaxes[0].max = '>200';
  //       data[0] = new TimeSeries({
  //         datapoints: [[120,10],[160,20]],
  //         alias: 'series1',
  //       });
  //     });
  //
  //     it('should set min to 100 and max to 200', function() {
  //        expect(ctx.plotOptions.yaxes[0].min).to.be(100);
  //        expect(ctx.plotOptions.yaxes[0].max).to.be(200);
  //     });
  //   });
  //   describe('and Y-Min is <100 and Y-Max is >200 and values outside range', function() {
  //     ctx.setup(function(ctrl, data) {
  //       ctrl.panel.yaxes[0].min = '<100';
  //       ctrl.panel.yaxes[0].max = '>200';
  //       data[0] = new TimeSeries({
  //         datapoints: [[99,10],[201,20]],
  //         alias: 'series1',
  //       });
  //     });
  //
  //     it('should set min to auto and max to auto', function() {
  //        expect(ctx.plotOptions.yaxes[0].min).to.be(null);
  //        expect(ctx.plotOptions.yaxes[0].max).to.be(null);
  //     });
  //   });
  //   describe('and Y-Min is =10.5 and Y-Max is =10.5', function() {
  //     ctx.setup(function(ctrl, data) {
  //       ctrl.panel.yaxes[0].min = '=10.5';
  //       ctrl.panel.yaxes[0].max = '=10.5';
  //       data[0] = new TimeSeries({
  //         datapoints: [[100,10],[120,20], [110,30]],
  //         alias: 'series1',
  //       });
  //     });
  //
  //     it('should set min to last value + 10.5 and max to last value + 10.5', function() {
  //        expect(ctx.plotOptions.yaxes[0].min).to.be(99.5);
  //        expect(ctx.plotOptions.yaxes[0].max).to.be(120.5);
  //     });
  //   });
  //   describe('and Y-Min is ~10.5 and Y-Max is ~10.5', function() {
  //     ctx.setup(function(ctrl, data) {
  //       ctrl.panel.yaxes[0].min = '~10.5';
  //       ctrl.panel.yaxes[0].max = '~10.5';
  //       data[0] = new TimeSeries({
  //         datapoints: [[102,10],[104,20], [110,30]], //Also checks precision
  //         alias: 'series1',
  //       });
  //     });
  //
  //     it('should set min to average value + 10.5 and max to average value + 10.5', function() {
  //        expect(ctx.plotOptions.yaxes[0].min).to.be(94.8);
  //        expect(ctx.plotOptions.yaxes[0].max).to.be(115.8);
  //     });
  //   });
  // });
  // graphScenario('when using regular Y-Min and Y-Max settings', function(ctx) {
  //   describe('and Y-Min is 100 and Y-Max is 200', function() {
  //     ctx.setup(function(ctrl, data) {
  //       ctrl.panel.yaxes[0].min = '100';
  //       ctrl.panel.yaxes[0].max = '200';
  //       data[0] = new TimeSeries({
  //         datapoints: [[120,10],[160,20]],
  //         alias: 'series1',
  //       });
  //     });
  //
  //     it('should set min to 100 and max to 200', function() {
  //        expect(ctx.plotOptions.yaxes[0].min).to.be(100);
  //        expect(ctx.plotOptions.yaxes[0].max).to.be(200);
  //     });
  //   });
  //   describe('and Y-Min is 0 and Y-Max is 0', function() {
  //     ctx.setup(function(ctrl, data) {
  //       ctrl.panel.yaxes[0].min = '0';
  //       ctrl.panel.yaxes[0].max = '0';
  //       data[0] = new TimeSeries({
  //         datapoints: [[120,10],[160,20]],
  //         alias: 'series1',
  //       });
  //     });
  //
  //     it('should set min to 0 and max to 0', function() {
  //        expect(ctx.plotOptions.yaxes[0].min).to.be(0);
  //        expect(ctx.plotOptions.yaxes[0].max).to.be(0);
  //     });
  //   });
  //   describe('and negative values used', function() {
  //     ctx.setup(function(ctrl, data) {
  //       ctrl.panel.yaxes[0].min = '-10';
  //       ctrl.panel.yaxes[0].max = '-13.14';
  //       data[0] = new TimeSeries({
  //         datapoints: [[120,10],[160,20]],
  //         alias: 'series1',
  //       });
  //     });
  //
  //     it('should set min and max to negative', function() {
  //        expect(ctx.plotOptions.yaxes[0].min).to.be(-10);
  //        expect(ctx.plotOptions.yaxes[0].max).to.be(-13.14);
  //     });
  //   });
  // });
  // graphScenario('when using Y-Min and Y-Max settings stored as number', function(ctx) {
  //   describe('and Y-Min is 0 and Y-Max is 100', function() {
  //     ctx.setup(function(ctrl, data) {
  //       ctrl.panel.yaxes[0].min = 0;
  //       ctrl.panel.yaxes[0].max = 100;
  //       data[0] = new TimeSeries({
  //         datapoints: [[120,10],[160,20]],
  //         alias: 'series1',
  //       });
  //     });
  //
  //     it('should set min to 0 and max to 100', function() {
  //        expect(ctx.plotOptions.yaxes[0].min).to.be(0);
  //        expect(ctx.plotOptions.yaxes[0].max).to.be(100);
  //     });
  //   });
  //   describe('and Y-Min is -100 and Y-Max is -10.5', function() {
  //     ctx.setup(function(ctrl, data) {
  //       ctrl.panel.yaxes[0].min = -100;
  //       ctrl.panel.yaxes[0].max = -10.5;
  //       data[0] = new TimeSeries({
  //         datapoints: [[120,10],[160,20]],
  //         alias: 'series1',
  //       });
  //     });
  //
  //     it('should set min to -100 and max to -10.5', function() {
  //        expect(ctx.plotOptions.yaxes[0].min).to.be(-100);
  //        expect(ctx.plotOptions.yaxes[0].max).to.be(-10.5);
  //     });
  //   });
  // });
});
