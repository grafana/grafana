import $ from 'jquery';

import { dateTime, EventBusSrv } from '@grafana/data';
import { MetricsPanelCtrl } from 'app/angular/panel/metrics_panel_ctrl';
import { PanelCtrl } from 'app/angular/panel/panel_ctrl';
import config from 'app/core/config';
import TimeSeries from 'app/core/time_series2';

import { createDashboardModelFixture } from '../../../../features/dashboard/state/__fixtures__/dashboardFixtures';
import { graphDirective, GraphElement } from '../graph';
import { GraphCtrl } from '../module';

jest.mock('../event_manager', () => ({
  EventManager: class EventManagerMock {
    on() {}
    addFlotEvents() {}
  },
}));

jest.mock('app/core/core', () => ({
  coreModule: {
    directive: () => {},
  },
  appEvents: {
    subscribe: () => {},
    on: () => {},
  },
}));

const ctx = {} as any;
let ctrl: any;
const scope = {
  ctrl: {},
  range: {
    from: dateTime([2015, 1, 1]),
    to: dateTime([2015, 11, 20]),
  },
  $on: () => {},
};
let link;

describe('grafanaGraph', () => {
  const setupCtx = (beforeRender?: any) => {
    config.bootData = {
      user: {
        lightTheme: false,
      },
    } as any;
    Object.assign(GraphCtrl.prototype, {
      ...MetricsPanelCtrl.prototype,
      ...PanelCtrl.prototype,
      ...GraphCtrl.prototype,
      height: 200,
      panel: {
        events: {
          on: () => {},
          emit: () => {},
        },
        legend: {},
        grid: {},
        yaxes: [
          {
            min: null,
            max: null,
            format: 'short',
            logBase: 1,
          },
          {
            min: null,
            max: null,
            format: 'short',
            logBase: 1,
          },
        ],
        thresholds: [],
        xaxis: {},
        seriesOverrides: [],
        tooltip: {
          shared: true,
        },
        fieldConfig: {
          defaults: {},
        },
      },
      renderingCompleted: jest.fn(),
      hiddenSeries: {},
      dashboard: {
        getTimezone: () => 'browser',
        events: new EventBusSrv(),
      },
      range: {
        from: dateTime([2015, 1, 1, 10]),
        to: dateTime([2015, 1, 1, 22]),
      },
      annotationsSrv: {
        getAnnotations: () => Promise.resolve({}),
      },
    }) as any;

    ctx.data = [];
    ctx.data.push(
      new TimeSeries({
        datapoints: [
          [1, 1],
          [2, 2],
        ],
        alias: 'series1',
      })
    );
    ctx.data.push(
      new TimeSeries({
        datapoints: [
          [10, 1],
          [20, 2],
        ],
        alias: 'series2',
      })
    );

    ctrl = new GraphCtrl(
      {
        $on: () => {},
        $parent: {
          panel: GraphCtrl.prototype.panel,
          dashboard: GraphCtrl.prototype.dashboard,
        },
      },
      {
        get: () => {},
      } as any
    );

    // @ts-ignore
    $.plot = ctrl.plot = jest.fn();
    scope.ctrl = ctrl;

    link = graphDirective({} as any, {}, {} as any).link(scope, {
      width: () => 500,
      mouseleave: () => {},
      bind: () => {},
    } as any);
    if (typeof beforeRender === 'function') {
      beforeRender();
    }
    link.data = ctx.data;

    //Emulate functions called by event listeners
    link.buildFlotPairs(link.data);
    link.renderPanel();
    ctx.plotData = ctrl.plot.mock.calls[0][1];

    ctx.plotOptions = ctrl.plot.mock.calls[0][2];
  };

  describe('simple lines options', () => {
    beforeEach(() => {
      setupCtx(() => {
        ctrl.panel.lines = true;
        ctrl.panel.fill = 5;
        ctrl.panel.linewidth = 3;
        ctrl.panel.steppedLine = true;
      });
    });

    it('should configure plot with correct options', () => {
      expect(ctx.plotOptions.series.lines.show).toBe(true);
      expect(ctx.plotOptions.series.lines.fill).toBe(0.5);
      expect(ctx.plotOptions.series.lines.lineWidth).toBe(3);
      expect(ctx.plotOptions.series.lines.steps).toBe(true);
    });
  });

  describe('sorting stacked series as legend. disabled', () => {
    beforeEach(() => {
      setupCtx(() => {
        ctrl.panel.legend.sort = undefined;
        ctrl.panel.stack = false;
      });
    });

    it('should not modify order of time series', () => {
      expect(ctx.plotData[0].alias).toBe('series1');
      expect(ctx.plotData[1].alias).toBe('series2');
    });
  });

  describe('sorting stacked series as legend. min descending order', () => {
    beforeEach(() => {
      setupCtx(() => {
        const sortKey = 'min';
        ctrl.panel.legend.sort = sortKey;
        ctrl.panel.legend.sortDesc = true;
        ctrl.panel.legend.alignAsTable = true;
        ctrl.panel.legend[sortKey] = true;
        ctrl.panel.stack = true;
      });
    });
    it('highest value should be first', () => {
      expect(ctx.plotData[0].alias).toBe('series2');
      expect(ctx.plotData[1].alias).toBe('series1');
    });
  });

  describe('sorting stacked series as legend. min ascending order', () => {
    beforeEach(() => {
      setupCtx(() => {
        ctrl.panel.legend.sort = 'min';
        ctrl.panel.legend.sortDesc = false;
        ctrl.panel.stack = true;
      });
    });
    it('lowest value should be first', () => {
      expect(ctx.plotData[0].alias).toBe('series1');
      expect(ctx.plotData[1].alias).toBe('series2');
    });
  });

  describe('sorting stacked series as legend. stacking disabled', () => {
    beforeEach(() => {
      setupCtx(() => {
        ctrl.panel.legend.sort = 'min';
        ctrl.panel.legend.sortDesc = true;
        ctrl.panel.stack = false;
      });
    });

    it('highest value should be first', () => {
      expect(ctx.plotData[0].alias).toBe('series1');
      expect(ctx.plotData[1].alias).toBe('series2');
    });
  });

  describe('sorting stacked series as legend. current descending order', () => {
    beforeEach(() => {
      setupCtx(() => {
        const sortKey = 'current';
        ctrl.panel.legend.sort = sortKey;
        ctrl.panel.legend.sortDesc = true;
        ctrl.panel.legend.alignAsTable = true;
        ctrl.panel.legend[sortKey] = true;
        ctrl.panel.stack = true;
      });
    });

    it('highest last value should be first', () => {
      expect(ctx.plotData[0].alias).toBe('series2');
      expect(ctx.plotData[1].alias).toBe('series1');
    });
  });

  describe('stacked series should not sort if legend is not as table or sort key column is not visible', () => {
    beforeEach(() => {
      setupCtx(() => {
        const sortKey = 'min';
        ctrl.panel.legend.sort = sortKey;
        ctrl.panel.legend.sortDesc = true;
        ctrl.panel.legend.alignAsTable = false;
        ctrl.panel.legend[sortKey] = false;
        ctrl.panel.stack = true;
      });
    });
    it('highest value should be first', () => {
      expect(ctx.plotData[0].alias).toBe('series1');
      expect(ctx.plotData[1].alias).toBe('series2');
    });
  });

  describe('when logBase is log 10', () => {
    beforeEach(() => {
      setupCtx(() => {
        ctx.data[0] = new TimeSeries({
          datapoints: [
            [2000, 1],
            [0.002, 2],
            [0, 3],
            [-1, 4],
          ],
          alias: 'seriesAutoscale',
        });
        ctx.data[0].yaxis = 1;
        ctx.data[1] = new TimeSeries({
          datapoints: [
            [2000, 1],
            [0.002, 2],
            [0, 3],
            [-1, 4],
          ],
          alias: 'seriesFixedscale',
        });
        ctx.data[1].yaxis = 2;
        ctrl.panel.yaxes[0].logBase = 10;

        ctrl.panel.yaxes[1].logBase = 10;
        ctrl.panel.yaxes[1].min = '0.05';
        ctrl.panel.yaxes[1].max = '1500';
      });
    });

    it('should apply axis transform, autoscaling (if necessary) and ticks', () => {
      const axisAutoscale = ctx.plotOptions.yaxes[0];
      expect(axisAutoscale.transform(100)).toBe(2);
      expect(axisAutoscale.inverseTransform(-3)).toBeCloseTo(0.001);
      expect(axisAutoscale.min).toBeCloseTo(0.001);
      expect(axisAutoscale.max).toBe(10000);
      expect(axisAutoscale.ticks.length).toBeCloseTo(8);
      expect(axisAutoscale.ticks[0]).toBeCloseTo(0.001);
      if (axisAutoscale.ticks.length === 7) {
        expect(axisAutoscale.ticks[axisAutoscale.ticks.length - 1]).toBeCloseTo(1000);
      } else {
        expect(axisAutoscale.ticks[axisAutoscale.ticks.length - 1]).toBe(10000);
      }

      const axisFixedscale = ctx.plotOptions.yaxes[1];
      expect(axisFixedscale.min).toBe(0.05);
      expect(axisFixedscale.max).toBe(1500);
      expect(axisFixedscale.ticks.length).toBe(5);
      expect(axisFixedscale.ticks[0]).toBe(0.1);
      expect(axisFixedscale.ticks[4]).toBe(1000);
    });
  });

  describe('when logBase is log 10 and data points contain only zeroes', () => {
    beforeEach(() => {
      setupCtx(() => {
        ctrl.panel.yaxes[0].logBase = 10;
        ctx.data[0] = new TimeSeries({
          datapoints: [
            [0, 1],
            [0, 2],
            [0, 3],
            [0, 4],
          ],
          alias: 'seriesAutoscale',
        });
        ctx.data[0].yaxis = 1;
      });
    });

    it('should not set min and max and should create some fake ticks', () => {
      const axisAutoscale = ctx.plotOptions.yaxes[0];
      expect(axisAutoscale.transform(100)).toBe(2);
      expect(axisAutoscale.inverseTransform(-3)).toBeCloseTo(0.001);
      expect(axisAutoscale.min).toBe(undefined);
      expect(axisAutoscale.max).toBe(undefined);
      expect(axisAutoscale.ticks.length).toBe(2);
      expect(axisAutoscale.ticks[0]).toBe(1);
      expect(axisAutoscale.ticks[1]).toBe(2);
    });
  });

  // y-min set 0 is a special case for log scale,
  // this approximates it by setting min to 0.1
  describe('when logBase is log 10 and y-min is set to 0 and auto min is > 0.1', () => {
    beforeEach(() => {
      setupCtx(() => {
        ctrl.panel.yaxes[0].logBase = 10;
        ctrl.panel.yaxes[0].min = '0';
        ctx.data[0] = new TimeSeries({
          datapoints: [
            [2000, 1],
            [4, 2],
            [500, 3],
            [3000, 4],
          ],
          alias: 'seriesAutoscale',
        });
        ctx.data[0].yaxis = 1;
      });
    });
    it('should set min to 0.1 and add a tick for 0.1', () => {
      const axisAutoscale = ctx.plotOptions.yaxes[0];
      expect(axisAutoscale.transform(100)).toBe(2);
      expect(axisAutoscale.inverseTransform(-3)).toBeCloseTo(0.001);
      expect(axisAutoscale.min).toBe(0.1);
      expect(axisAutoscale.max).toBe(10000);
      expect(axisAutoscale.ticks.length).toBe(6);
      expect(axisAutoscale.ticks[0]).toBe(0.1);
      expect(axisAutoscale.ticks[5]).toBe(10000);
    });
  });

  describe('when logBase is log 2 and y-min is set to 0 and num of ticks exceeds max', () => {
    beforeEach(() => {
      setupCtx(() => {
        const heightForApprox5Ticks = 125;
        ctrl.height = heightForApprox5Ticks;
        ctrl.panel.yaxes[0].logBase = 2;
        ctrl.panel.yaxes[0].min = '0';
        ctx.data[0] = new TimeSeries({
          datapoints: [
            [2000, 1],
            [4, 2],
            [500, 3],
            [3000, 4],
            [10000, 5],
            [100000, 6],
          ],
          alias: 'seriesAutoscale',
        });
        ctx.data[0].yaxis = 1;
      });
    });

    it('should regenerate ticks so that if fits on the y-axis', () => {
      const axisAutoscale = ctx.plotOptions.yaxes[0];
      expect(axisAutoscale.min).toBe(0.1);
      expect(axisAutoscale.ticks.length).toBe(8);
      expect(axisAutoscale.ticks[0]).toBe(0.1);
      expect(axisAutoscale.ticks[7]).toBe(262144);
      expect(axisAutoscale.max).toBe(262144);
    });

    it('should set axis max to be max tick value', () => {
      expect(ctx.plotOptions.yaxes[0].max).toBe(262144);
    });
  });

  describe('dashed lines options', () => {
    beforeEach(() => {
      setupCtx(() => {
        ctrl.panel.lines = true;
        ctrl.panel.linewidth = 2;
        ctrl.panel.dashes = true;
      });
    });

    it('should configure dashed plot with correct options', () => {
      expect(ctx.plotOptions.series.lines.show).toBe(true);
      expect(ctx.plotOptions.series.dashes.lineWidth).toBe(2);
      expect(ctx.plotOptions.series.dashes.show).toBe(true);
    });
  });

  describe('should use timeStep for barWidth', () => {
    beforeEach(() => {
      setupCtx(() => {
        ctrl.panel.bars = true;
        ctx.data[0] = new TimeSeries({
          datapoints: [
            [1, 10],
            [2, 20],
          ],
          alias: 'series1',
        });
      });
    });

    it('should set barWidth', () => {
      expect(ctx.plotOptions.series.bars.barWidth).toBe(1 / 1.5);
    });
  });

  describe('series option overrides, fill & points', () => {
    beforeEach(() => {
      setupCtx(() => {
        ctrl.panel.lines = true;
        ctrl.panel.fill = 5;
        ctx.data[0].zindex = 10;
        ctx.data[1].alias = 'test';
        ctx.data[1].lines = { fill: 0.001 };
        ctx.data[1].points = { show: true };
      });
    });

    it('should match second series and fill zero, and enable points', () => {
      expect(ctx.plotOptions.series.lines.fill).toBe(0.5);
      expect(ctx.plotData[1].lines.fill).toBe(0.001);
      expect(ctx.plotData[1].points.show).toBe(true);
    });
  });

  describe('should order series order according to zindex', () => {
    beforeEach(() => {
      setupCtx(() => {
        ctx.data[1].zindex = 1;
        ctx.data[0].zindex = 10;
      });
    });

    it('should move zindex 2 last', () => {
      expect(ctx.plotData[0].alias).toBe('series2');
      expect(ctx.plotData[1].alias).toBe('series1');
    });
  });

  describe('when series is hidden', () => {
    beforeEach(() => {
      setupCtx(() => {
        ctrl.hiddenSeries = { series2: true };
      });
    });

    it('should remove datapoints and disable stack', () => {
      expect(ctx.plotData[0].alias).toBe('series1');
      expect(ctx.plotData[1].data.length).toBe(0);
      expect(ctx.plotData[1].stack).toBe(false);
    });
  });

  describe('when stack and percent', () => {
    beforeEach(() => {
      setupCtx(() => {
        ctrl.panel.percentage = true;
        ctrl.panel.stack = true;
      });
    });

    it('should show percentage', () => {
      const axis = ctx.plotOptions.yaxes[0];
      expect(axis.tickFormatter(100, axis)).toBe('100%');
    });
  });

  describe('when panel too narrow to show x-axis dates in same granularity as wide panels', () => {
    //Set width to 10px
    describe('and the range is less than 24 hours', () => {
      beforeEach(() => {
        setupCtx(() => {
          ctrl.range.from = dateTime([2015, 1, 1, 10]);
          ctrl.range.to = dateTime([2015, 1, 1, 22]);
        });
      });

      it('should format dates as hours minutes', () => {
        const axis = ctx.plotOptions.xaxis;
        expect(axis.timeformat).toBe('HH:mm');
      });
    });

    describe('and the range is less than one year', () => {
      beforeEach(() => {
        setupCtx(() => {
          ctrl.range.from = dateTime([2015, 1, 1]);
          ctrl.range.to = dateTime([2015, 11, 20]);
        });
      });

      it('should format dates as month days', () => {
        const axis = ctx.plotOptions.xaxis;
        expect(axis.timeformat).toBe('MM/DD');
      });
    });
  });

  describe('when graph is histogram, and enable stack', () => {
    beforeEach(() => {
      setupCtx(() => {
        ctrl.panel.xaxis.mode = 'histogram';
        ctrl.panel.stack = true;
        ctrl.hiddenSeries = {};
        ctx.data[0] = new TimeSeries({
          datapoints: [
            [100, 1],
            [100, 2],
            [200, 3],
            [300, 4],
          ],
          alias: 'series1',
        });
        ctx.data[1] = new TimeSeries({
          datapoints: [
            [100, 1],
            [100, 2],
            [200, 3],
            [300, 4],
          ],
          alias: 'series2',
        });
      });
    });

    it('should calculate correct histogram', () => {
      expect(ctx.plotData[0].data[0][0]).toBe(100);
      expect(ctx.plotData[0].data[0][1]).toBe(2);
      expect(ctx.plotData[1].data[0][0]).toBe(100);
      expect(ctx.plotData[1].data[0][1]).toBe(2);
    });
  });

  describe('when graph is histogram, and some series are hidden', () => {
    beforeEach(() => {
      setupCtx(() => {
        ctrl.panel.xaxis.mode = 'histogram';
        ctrl.panel.stack = false;
        ctrl.hiddenSeries = { series2: true };
        ctx.data[0] = new TimeSeries({
          datapoints: [
            [100, 1],
            [100, 2],
            [200, 3],
            [300, 4],
          ],
          alias: 'series1',
        });
        ctx.data[1] = new TimeSeries({
          datapoints: [
            [100, 1],
            [100, 2],
            [200, 3],
            [300, 4],
          ],
          alias: 'series2',
        });
      });
    });

    it('should calculate correct histogram', () => {
      expect(ctx.plotData[0].data[0][0]).toBe(100);
      expect(ctx.plotData[0].data[0][1]).toBe(2);
    });
  });

  describe('when graph is histogram, and xaxis min is set', () => {
    beforeEach(() => {
      setupCtx(() => {
        ctrl.panel.xaxis.mode = 'histogram';
        ctrl.panel.xaxis.min = 150;
        ctrl.panel.stack = false;
        ctrl.hiddenSeries = {};
        ctx.data[0] = new TimeSeries({
          datapoints: [
            [100, 1],
            [100, 2],
            [200, 3],
            [300, 4],
          ],
          alias: 'series1',
        });
      });
    });

    it('should not contain values lower than min', () => {
      const nonZero = ctx.plotData[0].data.filter((t: number[]) => t[1] > 0);
      expect(
        Math.min.apply(
          Math,
          nonZero.map((t: number[]) => t[0])
        )
      ).toBe(200);
      expect(
        Math.max.apply(
          Math,
          nonZero.map((t: number[]) => t[0])
        )
      ).toBe(280);
    });
  });

  describe('when graph is histogram, and xaxis min is zero', () => {
    beforeEach(() => {
      setupCtx(() => {
        ctrl.panel.xaxis.mode = 'histogram';
        ctrl.panel.xaxis.min = 0;
        ctrl.panel.stack = false;
        ctrl.hiddenSeries = {};
        ctx.data[0] = new TimeSeries({
          datapoints: [
            [-100, 1],
            [100, 2],
            [200, 3],
            [300, 4],
          ],
          alias: 'series1',
        });
      });
    });

    it('should not contain values lower than zero', () => {
      const nonZero = ctx.plotData[0].data.filter((t: number[]) => t[1] > 0);
      expect(
        Math.min.apply(
          Math,
          nonZero.map((t: number[]) => t[0])
        )
      ).toBe(100);
      expect(
        Math.max.apply(
          Math,
          nonZero.map((t: number[]) => t[0])
        )
      ).toBe(280);
    });
  });

  describe('when graph is histogram, and xaxis min is null', () => {
    beforeEach(() => {
      setupCtx(() => {
        ctrl.panel.xaxis.mode = 'histogram';
        ctrl.panel.xaxis.min = null;
        ctrl.panel.stack = false;
        ctrl.hiddenSeries = {};
        ctx.data[0] = new TimeSeries({
          datapoints: [
            [-100, 1],
            [100, 2],
            [200, 3],
            [300, 4],
          ],
          alias: 'series1',
        });
      });
    });

    it('xaxis min should not affect the histogram', () => {
      const nonZero = ctx.plotData[0].data.filter((t: number[]) => t[1] > 0);
      expect(
        Math.min.apply(
          Math,
          nonZero.map((t: number[]) => t[0])
        )
      ).toBe(-100);
      expect(
        Math.max.apply(
          Math,
          nonZero.map((t: number[]) => t[0])
        )
      ).toBe(250);
    });
  });

  describe('when graph is histogram, and xaxis min is undefined', () => {
    beforeEach(() => {
      setupCtx(() => {
        ctrl.panel.xaxis.mode = 'histogram';
        ctrl.panel.xaxis.min = undefined;
        ctrl.panel.stack = false;
        ctrl.hiddenSeries = {};
        ctx.data[0] = new TimeSeries({
          datapoints: [
            [-100, 1],
            [100, 2],
            [200, 3],
            [300, 4],
          ],
          alias: 'series1',
        });
      });
    });

    it('xaxis min should not affect the histogram', () => {
      const nonZero = ctx.plotData[0].data.filter((t: number[]) => t[1] > 0);
      expect(
        Math.min.apply(
          Math,
          nonZero.map((t: number[]) => t[0])
        )
      ).toBe(-100);
      expect(
        Math.max.apply(
          Math,
          nonZero.map((t: number[]) => t[0])
        )
      ).toBe(250);
    });
  });

  describe('when graph is histogram, and xaxis max is set', () => {
    beforeEach(() => {
      setupCtx(() => {
        ctrl.panel.xaxis.mode = 'histogram';
        ctrl.panel.xaxis.max = 250;
        ctrl.panel.stack = false;
        ctrl.hiddenSeries = {};
        ctx.data[0] = new TimeSeries({
          datapoints: [
            [100, 1],
            [100, 2],
            [200, 3],
            [300, 4],
          ],
          alias: 'series1',
        });
      });
    });

    it('should not contain values greater than max', () => {
      const nonZero = ctx.plotData[0].data.filter((t: number[]) => t[1] > 0);
      expect(
        Math.min.apply(
          Math,
          nonZero.map((t: number[]) => t[0])
        )
      ).toBe(100);
      expect(
        Math.max.apply(
          Math,
          nonZero.map((t: number[]) => t[0])
        )
      ).toBe(200);
    });
  });

  describe('when graph is histogram, and xaxis max is zero', () => {
    beforeEach(() => {
      setupCtx(() => {
        ctrl.panel.xaxis.mode = 'histogram';
        ctrl.panel.xaxis.max = 0;
        ctrl.panel.stack = false;
        ctrl.hiddenSeries = {};
        ctx.data[0] = new TimeSeries({
          datapoints: [
            [-100, 1],
            [100, 1],
            [100, 2],
            [200, 3],
            [300, 4],
          ],
          alias: 'series1',
        });
      });
    });

    it('should not contain values greater than zero', () => {
      const nonZero = ctx.plotData[0].data.filter((t: number[]) => t[1] > 0);
      expect(
        Math.min.apply(
          Math,
          nonZero.map((t: number[]) => t[0])
        )
      ).toBe(-100);
      expect(
        Math.max.apply(
          Math,
          nonZero.map((t: number[]) => t[0])
        )
      ).toBe(-100);
    });
  });

  describe('when graph is histogram, and xaxis max is null', () => {
    beforeEach(() => {
      setupCtx(() => {
        ctrl.panel.xaxis.mode = 'histogram';
        ctrl.panel.xaxis.max = null;
        ctrl.panel.stack = false;
        ctrl.hiddenSeries = {};
        ctx.data[0] = new TimeSeries({
          datapoints: [
            [-100, 1],
            [100, 1],
            [100, 2],
            [200, 3],
            [300, 4],
          ],
          alias: 'series1',
        });
      });
    });

    it('xaxis max should not affect the histogram', () => {
      const nonZero = ctx.plotData[0].data.filter((t: number[]) => t[1] > 0);
      expect(
        Math.min.apply(
          Math,
          nonZero.map((t: number[]) => t[0])
        )
      ).toBe(-100);
      expect(
        Math.max.apply(
          Math,
          nonZero.map((t: number[]) => t[0])
        )
      ).toBe(250);
    });
  });

  describe('when graph is histogram, and xaxis max is undefined', () => {
    beforeEach(() => {
      setupCtx(() => {
        ctrl.panel.xaxis.mode = 'histogram';
        ctrl.panel.xaxis.max = undefined;
        ctrl.panel.stack = false;
        ctrl.hiddenSeries = {};
        ctx.data[0] = new TimeSeries({
          datapoints: [
            [-100, 1],
            [100, 1],
            [100, 2],
            [200, 3],
            [300, 4],
          ],
          alias: 'series1',
        });
      });
    });

    it('xaxis max should not should node affect the histogram', () => {
      const nonZero = ctx.plotData[0].data.filter((t: number[]) => t[1] > 0);
      expect(
        Math.min.apply(
          Math,
          nonZero.map((t: number[]) => t[0])
        )
      ).toBe(-100);
      expect(
        Math.max.apply(
          Math,
          nonZero.map((t: number[]) => t[0])
        )
      ).toBe(250);
    });
  });

  describe('when graph is histogram, and xaxis min and max are set', () => {
    beforeEach(() => {
      setupCtx(() => {
        ctrl.panel.xaxis.mode = 'histogram';
        ctrl.panel.xaxis.min = 150;
        ctrl.panel.xaxis.max = 250;
        ctrl.panel.stack = false;
        ctrl.hiddenSeries = {};
        ctx.data[0] = new TimeSeries({
          datapoints: [
            [100, 1],
            [100, 2],
            [200, 3],
            [300, 4],
          ],
          alias: 'series1',
        });
      });
    });

    it('should not contain values lower than min and greater than max', () => {
      const nonZero = ctx.plotData[0].data.filter((t: number[]) => t[1] > 0);
      expect(
        Math.min.apply(
          Math,
          nonZero.map((t: number[]) => t[0])
        )
      ).toBe(200);
      expect(
        Math.max.apply(
          Math,
          nonZero.map((t: number[]) => t[0])
        )
      ).toBe(200);
    });
  });

  describe('when graph is histogram, and xaxis min and max are zero', () => {
    beforeEach(() => {
      setupCtx(() => {
        ctrl.panel.xaxis.mode = 'histogram';
        ctrl.panel.xaxis.min = 0;
        ctrl.panel.xaxis.max = 0;
        ctrl.panel.stack = false;
        ctrl.hiddenSeries = {};
        ctx.data[0] = new TimeSeries({
          datapoints: [
            [-100, 1],
            [100, 1],
            [100, 2],
            [200, 3],
            [300, 4],
          ],
          alias: 'series1',
        });
      });
    });

    it('xaxis max should be ignored otherwise the bucketSize is zero', () => {
      const nonZero = ctx.plotData[0].data.filter((t: number[]) => t[1] > 0);
      expect(
        Math.min.apply(
          Math,
          nonZero.map((t: number[]) => t[0])
        )
      ).toBe(100);
      expect(
        Math.max.apply(
          Math,
          nonZero.map((t: number[]) => t[0])
        )
      ).toBe(280);
    });
  });

  describe('when graph is histogram, and xaxis min and max are null', () => {
    beforeEach(() => {
      setupCtx(() => {
        ctrl.panel.xaxis.mode = 'histogram';
        ctrl.panel.xaxis.min = null;
        ctrl.panel.xaxis.max = null;
        ctrl.panel.stack = false;
        ctrl.hiddenSeries = {};
        ctx.data[0] = new TimeSeries({
          datapoints: [
            [100, 1],
            [100, 2],
            [200, 3],
            [300, 4],
          ],
          alias: 'series1',
        });
      });
    });

    it('xaxis min and max should not affect the histogram', () => {
      const nonZero = ctx.plotData[0].data.filter((t: number[]) => t[1] > 0);
      expect(
        Math.min.apply(
          Math,
          nonZero.map((t: number[]) => t[0])
        )
      ).toBe(100);
      expect(
        Math.max.apply(
          Math,
          nonZero.map((t: number[]) => t[0])
        )
      ).toBe(280);
    });
  });

  describe('when graph is histogram, and xaxis min and max are undefined', () => {
    beforeEach(() => {
      setupCtx(() => {
        ctrl.panel.xaxis.mode = 'histogram';
        ctrl.panel.xaxis.min = undefined;
        ctrl.panel.xaxis.max = undefined;
        ctrl.panel.stack = false;
        ctrl.hiddenSeries = {};
        ctx.data[0] = new TimeSeries({
          datapoints: [
            [100, 1],
            [100, 2],
            [200, 3],
            [300, 4],
          ],
          alias: 'series1',
        });
      });
    });

    it('xaxis min and max should not affect the histogram', () => {
      const nonZero = ctx.plotData[0].data.filter((t: number[]) => t[1] > 0);
      expect(
        Math.min.apply(
          Math,
          nonZero.map((t: number[]) => t[0])
        )
      ).toBe(100);
      expect(
        Math.max.apply(
          Math,
          nonZero.map((t: number[]) => t[0])
        )
      ).toBe(280);
    });
  });

  describe('when graph is histogram, and xaxis min is greater than xaxis max', () => {
    beforeEach(() => {
      setupCtx(() => {
        ctrl.panel.xaxis.mode = 'histogram';
        ctrl.panel.xaxis.min = 150;
        ctrl.panel.xaxis.max = 100;
        ctrl.panel.stack = false;
        ctrl.hiddenSeries = {};
        ctx.data[0] = new TimeSeries({
          datapoints: [
            [100, 1],
            [100, 2],
            [200, 3],
            [300, 4],
          ],
          alias: 'series1',
        });
      });
    });

    it('xaxis max should be ignored otherwise the bucketSize is negative', () => {
      const nonZero = ctx.plotData[0].data.filter((t: number[]) => t[1] > 0);
      expect(
        Math.min.apply(
          Math,
          nonZero.map((t: number[]) => t[0])
        )
      ).toBe(200);
      expect(
        Math.max.apply(
          Math,
          nonZero.map((t: number[]) => t[0])
        )
      ).toBe(280);
    });
  });

  // aaa
  describe('when graph is histogram, and xaxis min is greater than the maximum value', () => {
    beforeEach(() => {
      setupCtx(() => {
        ctrl.panel.xaxis.mode = 'histogram';
        ctrl.panel.xaxis.min = 301;
        ctrl.panel.stack = false;
        ctrl.hiddenSeries = {};
        ctx.data[0] = new TimeSeries({
          datapoints: [
            [100, 1],
            [100, 2],
            [200, 3],
            [300, 4],
          ],
          alias: 'series1',
        });
      });
    });

    it('xaxis min should be ignored otherwise the bucketSize is negative', () => {
      const nonZero = ctx.plotData[0].data.filter((t: number[]) => t[1] > 0);
      expect(
        Math.min.apply(
          Math,
          nonZero.map((t: number[]) => t[0])
        )
      ).toBe(100);
      expect(
        Math.max.apply(
          Math,
          nonZero.map((t: number[]) => t[0])
        )
      ).toBe(280);
    });
  });

  describe('when graph is histogram, and xaxis min is equal to the maximum value', () => {
    beforeEach(() => {
      setupCtx(() => {
        ctrl.panel.xaxis.mode = 'histogram';
        ctrl.panel.xaxis.min = 300;
        ctrl.panel.stack = false;
        ctrl.hiddenSeries = {};
        ctx.data[0] = new TimeSeries({
          datapoints: [
            [100, 1],
            [100, 2],
            [200, 3],
            [300, 4],
          ],
          alias: 'series1',
        });
      });
    });

    it('xaxis min should be ignored otherwise the bucketSize is zero', () => {
      const nonZero = ctx.plotData[0].data.filter((t: number[]) => t[1] > 0);
      expect(
        Math.min.apply(
          Math,
          nonZero.map((t: number[]) => t[0])
        )
      ).toBe(100);
      expect(
        Math.max.apply(
          Math,
          nonZero.map((t: number[]) => t[0])
        )
      ).toBe(280);
    });
  });

  describe('when graph is histogram, and xaxis min is lower than the minimum value', () => {
    beforeEach(() => {
      setupCtx(() => {
        ctrl.panel.xaxis.mode = 'histogram';
        ctrl.panel.xaxis.min = 99;
        ctrl.panel.stack = false;
        ctrl.hiddenSeries = {};
        ctx.data[0] = new TimeSeries({
          datapoints: [
            [100, 1],
            [100, 2],
            [200, 3],
            [300, 4],
          ],
          alias: 'series1',
        });
      });
    });

    it('xaxis min should not affect the histogram', () => {
      const nonZero = ctx.plotData[0].data.filter((t: number[]) => t[1] > 0);
      expect(
        Math.min.apply(
          Math,
          nonZero.map((t: number[]) => t[0])
        )
      ).toBe(100);
      expect(
        Math.max.apply(
          Math,
          nonZero.map((t: number[]) => t[0])
        )
      ).toBe(280);
    });
  });

  describe('when graph is histogram, and xaxis max is equal to the minimum value', () => {
    beforeEach(() => {
      setupCtx(() => {
        ctrl.panel.xaxis.mode = 'histogram';
        ctrl.panel.xaxis.max = 100;
        ctrl.panel.stack = false;
        ctrl.hiddenSeries = {};
        ctx.data[0] = new TimeSeries({
          datapoints: [
            [100, 1],
            [100, 2],
            [200, 3],
            [300, 4],
          ],
          alias: 'series1',
        });
      });
    });

    it('should calculate correct histogram', () => {
      const nonZero = ctx.plotData[0].data.filter((t: number[]) => t[1] > 0);
      expect(
        Math.min.apply(
          Math,
          nonZero.map((t: number[]) => t[0])
        )
      ).toBe(90);
      expect(
        Math.max.apply(
          Math,
          nonZero.map((t: number[]) => t[0])
        )
      ).toBe(90);
    });
  });

  describe('when graph is histogram, and xaxis max is a lower than the minimum value', () => {
    beforeEach(() => {
      setupCtx(() => {
        ctrl.panel.xaxis.mode = 'histogram';
        ctrl.panel.xaxis.max = 99;
        ctrl.panel.stack = false;
        ctrl.hiddenSeries = {};
        ctx.data[0] = new TimeSeries({
          datapoints: [
            [100, 1],
            [100, 2],
            [200, 3],
            [300, 4],
          ],
          alias: 'series1',
        });
      });
    });

    it('should calculate empty histogram', () => {
      const nonZero = ctx.plotData[0].data.filter((t: number[]) => t[1] > 0);
      expect(nonZero.length).toBe(0);
    });
  });

  describe('when graph is histogram, and xaxis max is greater than the maximum value', () => {
    beforeEach(() => {
      setupCtx(() => {
        ctrl.panel.xaxis.mode = 'histogram';
        ctrl.panel.xaxis.max = 400;
        ctrl.panel.stack = false;
        ctrl.hiddenSeries = {};
        ctx.data[0] = new TimeSeries({
          datapoints: [
            [100, 1],
            [100, 2],
            [200, 3],
            [300, 4],
          ],
          alias: 'series1',
        });
      });
    });

    it('should calculate correct histogram', () => {
      const nonZero = ctx.plotData[0].data.filter((t: number[]) => t[1] > 0);
      expect(
        Math.min.apply(
          Math,
          nonZero.map((t: number[]) => t[0])
        )
      ).toBe(100);
      expect(
        Math.max.apply(
          Math,
          nonZero.map((t: number[]) => t[0])
        )
      ).toBe(300);
    });
  });

  describe('getContextMenuItemsSupplier', () => {
    describe('when called and user can edit the dashboard', () => {
      it('then the correct menu items should be returned', () => {
        const element = getGraphElement({ canEdit: true, canMakeEditable: false });
        jest.spyOn(element.dashboard, 'canAddAnnotations').mockReturnValue(true);

        const result = element.getContextMenuItemsSupplier({ x: 1, y: 1 })();

        expect(result.length).toEqual(1);
        expect(result[0].items.length).toEqual(1);
        expect(result[0].items[0].label).toEqual('Add annotation');
        expect(result[0].items[0].icon).toEqual('comment-alt');
        expect(result[0].items[0].onClick).toBeDefined();
      });
    });

    describe('when called and user can make the dashboard editable', () => {
      it('then the correct menu items should be returned', () => {
        const element = getGraphElement({ canEdit: false, canMakeEditable: true });
        jest.spyOn(element.dashboard, 'canAddAnnotations').mockReturnValue(true);

        const result = element.getContextMenuItemsSupplier({ x: 1, y: 1 })();

        expect(result.length).toEqual(1);
        expect(result[0].items.length).toEqual(1);
        expect(result[0].items[0].label).toEqual('Add annotation');
        expect(result[0].items[0].icon).toEqual('comment-alt');
        expect(result[0].items[0].onClick).toBeDefined();
      });
    });

    describe('when called and user can not edit the dashboard and can not make the dashboard editable', () => {
      it('then the correct menu items should be returned', () => {
        const element = getGraphElement({ canEdit: false, canMakeEditable: false });

        const result = element.getContextMenuItemsSupplier({ x: 1, y: 1 })();

        expect(result.length).toEqual(0);
      });
    });
  });
});

function getGraphElement({ canEdit, canMakeEditable }: { canEdit?: boolean; canMakeEditable?: boolean } = {}) {
  const dashboard = createDashboardModelFixture({});
  dashboard.events.on = jest.fn();
  dashboard.meta.canEdit = canEdit;
  dashboard.meta.canMakeEditable = canMakeEditable;
  const element = new GraphElement(
    {
      ctrl: {
        contextMenuCtrl: {},
        dashboard,
        events: { on: jest.fn() },
      },
    },
    { mouseleave: jest.fn(), bind: jest.fn() } as any,
    {} as any
  );

  return element;
}
