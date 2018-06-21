import { TimeRegionManager, colorModes } from '../time_region_manager';
import moment from 'moment';

describe('TimeRegionManager', () => {
  function plotOptionsScenario(desc, func) {
    describe(desc, () => {
      const ctx: any = {
        panel: {
          timeRegions: [],
        },
        options: {
          grid: { markings: [] },
        },
        panelCtrl: {
          range: {},
          dashboard: {
            isTimezoneUtc: () => false,
          },
        },
      };

      ctx.setup = (regions, from, to) => {
        ctx.panel.timeRegions = regions;
        ctx.panelCtrl.range.from = from;
        ctx.panelCtrl.range.to = to;
        const manager = new TimeRegionManager(ctx.panelCtrl);
        manager.addFlotOptions(ctx.options, ctx.panel);
      };

      ctx.printScenario = () => {
        console.log(`Time range: from=${ctx.panelCtrl.range.from.format()}, to=${ctx.panelCtrl.range.to.format()}`);
        ctx.options.grid.markings.forEach((m, i) => {
          console.log(
            `Marking (${i}): from=${moment(m.xaxis.from).format()}, to=${moment(m.xaxis.to).format()}, color=${m.color}`
          );
        });
      };

      func(ctx);
    });
  }

  describe('When creating plot markings', () => {
    plotOptionsScenario('for day of week region', ctx => {
      const regions = [{ fromDayOfWeek: 1, toDayOfWeek: 1, fill: true, line: true, colorMode: 'red' }];
      const from = moment('2018-01-01 00:00');
      const to = moment('2018-01-01 23:59');
      ctx.setup(regions, from, to);

      it('should add 3 markings', () => {
        expect(ctx.options.grid.markings.length).toBe(3);
      });

      it('should add fill', () => {
        const markings = ctx.options.grid.markings;
        expect(moment(markings[0].xaxis.from).format()).toBe(from.format());
        expect(moment(markings[0].xaxis.to).format()).toBe(to.format());
        expect(markings[0].color).toBe(colorModes.red.color.fill);
      });

      it('should add line before', () => {
        const markings = ctx.options.grid.markings;
        expect(moment(markings[1].xaxis.from).format()).toBe(from.format());
        expect(moment(markings[1].xaxis.to).format()).toBe(from.format());
        expect(markings[1].color).toBe(colorModes.red.color.line);
      });

      it('should add line after', () => {
        const markings = ctx.options.grid.markings;
        expect(moment(markings[2].xaxis.from).format()).toBe(to.format());
        expect(moment(markings[2].xaxis.to).format()).toBe(to.format());
        expect(markings[2].color).toBe(colorModes.red.color.line);
      });
    });

    plotOptionsScenario('for time from region', ctx => {
      const regions = [{ from: '05:00', fill: true, colorMode: 'red' }];
      const from = moment('2018-01-01 00:00');
      const to = moment('2018-01-03 23:59');
      ctx.setup(regions, from, to);

      it('should add 3 markings', () => {
        expect(ctx.options.grid.markings.length).toBe(3);
      });

      it('should add one fill at 05:00 each day', () => {
        const markings = ctx.options.grid.markings;

        const firstFill = moment(from.add(5, 'hours'));
        expect(moment(markings[0].xaxis.from).format()).toBe(firstFill.format());
        expect(moment(markings[0].xaxis.to).format()).toBe(firstFill.format());
        expect(markings[0].color).toBe(colorModes.red.color.fill);

        const secondFill = moment(firstFill).add(1, 'days');
        expect(moment(markings[1].xaxis.from).format()).toBe(secondFill.format());
        expect(moment(markings[1].xaxis.to).format()).toBe(secondFill.format());
        expect(markings[1].color).toBe(colorModes.red.color.fill);

        const thirdFill = moment(secondFill).add(1, 'days');
        expect(moment(markings[2].xaxis.from).format()).toBe(thirdFill.format());
        expect(moment(markings[2].xaxis.to).format()).toBe(thirdFill.format());
        expect(markings[2].color).toBe(colorModes.red.color.fill);
      });
    });

    plotOptionsScenario('for time to region', ctx => {
      const regions = [{ to: '05:00', fill: true, colorMode: 'red' }];
      const from = moment('2018-02-01 00:00');
      const to = moment('2018-02-03 23:59');
      ctx.setup(regions, from, to);

      it('should add 3 markings', () => {
        expect(ctx.options.grid.markings.length).toBe(3);
      });

      it('should add one fill at 05:00 each day', () => {
        const markings = ctx.options.grid.markings;

        const firstFill = moment(from.add(5, 'hours'));
        expect(moment(markings[0].xaxis.from).format()).toBe(firstFill.format());
        expect(moment(markings[0].xaxis.to).format()).toBe(firstFill.format());
        expect(markings[0].color).toBe(colorModes.red.color.fill);

        const secondFill = moment(firstFill).add(1, 'days');
        expect(moment(markings[1].xaxis.from).format()).toBe(secondFill.format());
        expect(moment(markings[1].xaxis.to).format()).toBe(secondFill.format());
        expect(markings[1].color).toBe(colorModes.red.color.fill);

        const thirdFill = moment(secondFill).add(1, 'days');
        expect(moment(markings[2].xaxis.from).format()).toBe(thirdFill.format());
        expect(moment(markings[2].xaxis.to).format()).toBe(thirdFill.format());
        expect(markings[2].color).toBe(colorModes.red.color.fill);
      });
    });

    plotOptionsScenario('for day of week from/to region', ctx => {
      const regions = [{ fromDayOfWeek: 7, toDayOfWeek: 7, fill: true, colorMode: 'red' }];
      const from = moment('2018-01-01 18:45:05');
      const to = moment('2018-01-22 08:27:00');
      ctx.setup(regions, from, to);

      it('should add 3 markings', () => {
        expect(ctx.options.grid.markings.length).toBe(3);
      });

      it('should add one fill at each sunday', () => {
        const markings = ctx.options.grid.markings;

        expect(moment(markings[0].xaxis.from).format()).toBe(moment('2018-01-07 00:00:00').format());
        expect(moment(markings[0].xaxis.to).format()).toBe(moment('2018-01-07 23:59:59').format());
        expect(markings[0].color).toBe(colorModes.red.color.fill);

        expect(moment(markings[1].xaxis.from).format()).toBe(moment('2018-01-14 00:00:00').format());
        expect(moment(markings[1].xaxis.to).format()).toBe(moment('2018-01-14 23:59:59').format());
        expect(markings[1].color).toBe(colorModes.red.color.fill);

        expect(moment(markings[2].xaxis.from).format()).toBe(moment('2018-01-21 00:00:00').format());
        expect(moment(markings[2].xaxis.to).format()).toBe(moment('2018-01-21 23:59:59').format());
        expect(markings[2].color).toBe(colorModes.red.color.fill);
      });
    });

    plotOptionsScenario('for day of week from region', ctx => {
      const regions = [{ fromDayOfWeek: 7, fill: true, colorMode: 'red' }];
      const from = moment('2018-01-01 18:45:05');
      const to = moment('2018-01-22 08:27:00');
      ctx.setup(regions, from, to);

      it('should add 3 markings', () => {
        expect(ctx.options.grid.markings.length).toBe(3);
      });

      it('should add one fill at each sunday', () => {
        const markings = ctx.options.grid.markings;

        expect(moment(markings[0].xaxis.from).format()).toBe(moment('2018-01-07 00:00:00').format());
        expect(moment(markings[0].xaxis.to).format()).toBe(moment('2018-01-07 23:59:59').format());
        expect(markings[0].color).toBe(colorModes.red.color.fill);

        expect(moment(markings[1].xaxis.from).format()).toBe(moment('2018-01-14 00:00:00').format());
        expect(moment(markings[1].xaxis.to).format()).toBe(moment('2018-01-14 23:59:59').format());
        expect(markings[1].color).toBe(colorModes.red.color.fill);

        expect(moment(markings[2].xaxis.from).format()).toBe(moment('2018-01-21 00:00:00').format());
        expect(moment(markings[2].xaxis.to).format()).toBe(moment('2018-01-21 23:59:59').format());
        expect(markings[2].color).toBe(colorModes.red.color.fill);
      });
    });

    plotOptionsScenario('for day of week to region', ctx => {
      const regions = [{ toDayOfWeek: 7, fill: true, colorMode: 'red' }];
      const from = moment('2018-01-01 18:45:05');
      const to = moment('2018-01-22 08:27:00');
      ctx.setup(regions, from, to);

      it('should add 3 markings', () => {
        expect(ctx.options.grid.markings.length).toBe(3);
      });

      it('should add one fill at each sunday', () => {
        const markings = ctx.options.grid.markings;

        expect(moment(markings[0].xaxis.from).format()).toBe(moment('2018-01-07 00:00:00').format());
        expect(moment(markings[0].xaxis.to).format()).toBe(moment('2018-01-07 23:59:59').format());
        expect(markings[0].color).toBe(colorModes.red.color.fill);

        expect(moment(markings[1].xaxis.from).format()).toBe(moment('2018-01-14 00:00:00').format());
        expect(moment(markings[1].xaxis.to).format()).toBe(moment('2018-01-14 23:59:59').format());
        expect(markings[1].color).toBe(colorModes.red.color.fill);

        expect(moment(markings[2].xaxis.from).format()).toBe(moment('2018-01-21 00:00:00').format());
        expect(moment(markings[2].xaxis.to).format()).toBe(moment('2018-01-21 23:59:59').format());
        expect(markings[2].color).toBe(colorModes.red.color.fill);
      });
    });
  });
});
