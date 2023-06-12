import angular from 'angular';

import TimeSeries from 'app/core/time_series2';

import { ThresholdManager } from '../threshold_manager';

describe('ThresholdManager', () => {
  function plotOptionsScenario(desc: string, func: any) {
    describe(desc, () => {
      const ctx: any = {
        panel: {
          thresholds: [],
        },
        options: {
          grid: { markings: [] },
        },
        panelCtrl: {},
      };

      ctx.setup = (thresholds: any, data: any) => {
        ctx.panel.thresholds = thresholds;
        const manager = new ThresholdManager(ctx.panelCtrl);
        if (data !== undefined) {
          const element = angular.element('<div grafana-graph><div>');
          manager.prepare(element, data);
        }
        manager.addFlotOptions(ctx.options, ctx.panel);
      };

      func(ctx);
    });
  }

  describe('When creating plot markings', () => {
    plotOptionsScenario('for simple gt threshold', (ctx: any) => {
      ctx.setup([{ op: 'gt', value: 300, fill: true, line: true, colorMode: 'critical' }]);

      it('should add fill for threshold with fill: true', () => {
        const markings = ctx.options.grid.markings;

        expect(markings[0].yaxis.from).toBe(300);
        expect(markings[0].yaxis.to).toBe(Infinity);
        expect(markings[0].color).toBe('rgba(234, 112, 112, 0.12)');
      });

      it('should add line', () => {
        const markings = ctx.options.grid.markings;
        expect(markings[1].yaxis.from).toBe(300);
        expect(markings[1].yaxis.to).toBe(300);
        expect(markings[1].color).toBe('rgba(237, 46, 24, 0.60)');
      });
    });

    plotOptionsScenario('for two gt thresholds', (ctx: any) => {
      ctx.setup([
        { op: 'gt', value: 200, fill: true, colorMode: 'warning' },
        { op: 'gt', value: 300, fill: true, colorMode: 'critical' },
      ]);

      it('should add fill for first thresholds to next threshold', () => {
        const markings = ctx.options.grid.markings;
        expect(markings[0].yaxis.from).toBe(200);
        expect(markings[0].yaxis.to).toBe(300);
      });

      it('should add fill for last thresholds to infinity', () => {
        const markings = ctx.options.grid.markings;
        expect(markings[1].yaxis.from).toBe(300);
        expect(markings[1].yaxis.to).toBe(Infinity);
      });
    });

    plotOptionsScenario('for lt then gt threshold (inside)', (ctx: any) => {
      ctx.setup([
        { op: 'lt', value: 300, fill: true, colorMode: 'critical' },
        { op: 'gt', value: 200, fill: true, colorMode: 'critical' },
      ]);

      it('should add fill for first thresholds to next threshold', () => {
        const markings = ctx.options.grid.markings;
        expect(markings[0].yaxis.from).toBe(300);
        expect(markings[0].yaxis.to).toBe(200);
      });

      it('should add fill for last thresholds to itself', () => {
        const markings = ctx.options.grid.markings;
        expect(markings[1].yaxis.from).toBe(200);
        expect(markings[1].yaxis.to).toBe(200);
      });
    });

    plotOptionsScenario('for gt then lt threshold (outside)', (ctx: any) => {
      ctx.setup([
        { op: 'gt', value: 300, fill: true, colorMode: 'critical' },
        { op: 'lt', value: 200, fill: true, colorMode: 'critical' },
      ]);

      it('should add fill for first thresholds to next threshold', () => {
        const markings = ctx.options.grid.markings;
        expect(markings[0].yaxis.from).toBe(300);
        expect(markings[0].yaxis.to).toBe(Infinity);
      });

      it('should add fill for last thresholds to itself', () => {
        const markings = ctx.options.grid.markings;
        expect(markings[1].yaxis.from).toBe(200);
        expect(markings[1].yaxis.to).toBe(-Infinity);
      });
    });

    plotOptionsScenario('for threshold on two Y axes', (ctx: any) => {
      const data = new Array(2);
      data[0] = new TimeSeries({
        datapoints: [
          [0, 1],
          [300, 2],
        ],
        alias: 'left',
      });
      data[0].yaxis = 1;
      data[1] = new TimeSeries({
        datapoints: [
          [0, 1],
          [300, 2],
        ],
        alias: 'right',
      });
      data[1].yaxis = 2;
      ctx.setup(
        [
          { op: 'gt', value: 100, line: true, colorMode: 'critical' },
          { op: 'gt', value: 200, line: true, colorMode: 'critical', yaxis: 'right' },
        ],
        data
      );

      it('should add first threshold for left axis', () => {
        const markings = ctx.options.grid.markings;
        expect(markings[0].yaxis.from).toBe(100);
      });

      it('should add second threshold for right axis', () => {
        const markings = ctx.options.grid.markings;
        expect(markings[1].y2axis.from).toBe(200);
      });
    });
  });
});
