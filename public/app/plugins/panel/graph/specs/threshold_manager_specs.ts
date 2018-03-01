import { describe, it, expect } from '../../../../../test/lib/common';

import { ThresholdManager } from '../threshold_manager';

describe('ThresholdManager', function() {
  function plotOptionsScenario(desc, func) {
    describe(desc, function() {
      var ctx: any = {
        panel: {
          thresholds: [],
        },
        options: {
          grid: { markings: [] },
        },
        panelCtrl: {},
      };

      ctx.setup = function(thresholds) {
        ctx.panel.thresholds = thresholds;
        var manager = new ThresholdManager(ctx.panelCtrl);
        manager.addFlotOptions(ctx.options, ctx.panel);
      };

      func(ctx);
    });
  }

  describe('When creating plot markings', () => {
    plotOptionsScenario('for simple gt threshold', ctx => {
      ctx.setup([{ op: 'gt', value: 300, fill: true, line: true, colorMode: 'critical' }]);

      it('should add fill for threshold with fill: true', function() {
        var markings = ctx.options.grid.markings;

        expect(markings[0].yaxis.from).to.be(300);
        expect(markings[0].yaxis.to).to.be(Infinity);
        expect(markings[0].color).to.be('rgba(234, 112, 112, 0.12)');
      });

      it('should add line', function() {
        var markings = ctx.options.grid.markings;
        expect(markings[1].yaxis.from).to.be(300);
        expect(markings[1].yaxis.to).to.be(300);
        expect(markings[1].color).to.be('rgba(237, 46, 24, 0.60)');
      });
    });

    plotOptionsScenario('for two gt thresholds', ctx => {
      ctx.setup([
        { op: 'gt', value: 200, fill: true, colorMode: 'warning' },
        { op: 'gt', value: 300, fill: true, colorMode: 'critical' },
      ]);

      it('should add fill for first thresholds to next threshold', function() {
        var markings = ctx.options.grid.markings;
        expect(markings[0].yaxis.from).to.be(200);
        expect(markings[0].yaxis.to).to.be(300);
      });

      it('should add fill for last thresholds to infinity', function() {
        var markings = ctx.options.grid.markings;
        expect(markings[1].yaxis.from).to.be(300);
        expect(markings[1].yaxis.to).to.be(Infinity);
      });
    });

    plotOptionsScenario('for lt then gt threshold (inside)', ctx => {
      ctx.setup([
        { op: 'lt', value: 300, fill: true, colorMode: 'critical' },
        { op: 'gt', value: 200, fill: true, colorMode: 'critical' },
      ]);

      it('should add fill for first thresholds to next threshold', function() {
        var markings = ctx.options.grid.markings;
        expect(markings[0].yaxis.from).to.be(300);
        expect(markings[0].yaxis.to).to.be(200);
      });

      it('should add fill for last thresholds to itself', function() {
        var markings = ctx.options.grid.markings;
        expect(markings[1].yaxis.from).to.be(200);
        expect(markings[1].yaxis.to).to.be(200);
      });
    });

    plotOptionsScenario('for gt then lt threshold (outside)', ctx => {
      ctx.setup([
        { op: 'gt', value: 300, fill: true, colorMode: 'critical' },
        { op: 'lt', value: 200, fill: true, colorMode: 'critical' },
      ]);

      it('should add fill for first thresholds to next threshold', function() {
        var markings = ctx.options.grid.markings;
        expect(markings[0].yaxis.from).to.be(300);
        expect(markings[0].yaxis.to).to.be(Infinity);
      });

      it('should add fill for last thresholds to itself', function() {
        var markings = ctx.options.grid.markings;
        expect(markings[1].yaxis.from).to.be(200);
        expect(markings[1].yaxis.to).to.be(-Infinity);
      });
    });
  });
});
