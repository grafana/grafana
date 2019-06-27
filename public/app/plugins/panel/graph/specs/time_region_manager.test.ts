import { TimeRegionManager, colorModes } from '../time_region_manager';
import { dateTime } from '@grafana/ui/src/utils/moment_wrapper';

describe('TimeRegionManager', () => {
  function plotOptionsScenario(desc: string, func: any) {
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

      ctx.setup = (regions: any, from: any, to: any) => {
        ctx.panel.timeRegions = regions;
        ctx.panelCtrl.range.from = from;
        ctx.panelCtrl.range.to = to;
        const manager = new TimeRegionManager(ctx.panelCtrl);
        manager.addFlotOptions(ctx.options, ctx.panel);
      };

      ctx.printScenario = () => {
        console.log(
          `Time range: from=${ctx.panelCtrl.range.from.format()}, to=${ctx.panelCtrl.range.to.format()}`,
          ctx.panelCtrl.range.from._isUTC
        );
        ctx.options.grid.markings.forEach((m: any, i: number) => {
          console.log(
            `Marking (${i}): from=${dateTime(m.xaxis.from).format()}, to=${dateTime(m.xaxis.to).format()}, color=${
              m.color
            }`
          );
        });
      };

      func(ctx);
    });
  }

  describe('When colors missing in config', () => {
    plotOptionsScenario('should not throw an error when fillColor is undefined', (ctx: any) => {
      const regions = [
        { fromDayOfWeek: 1, toDayOfWeek: 1, fill: true, line: true, lineColor: '#ffffff', colorMode: 'custom' },
      ];
      const from = dateTime('2018-01-01T00:00:00+01:00');
      const to = dateTime('2018-01-01T23:59:00+01:00');
      expect(() => ctx.setup(regions, from, to)).not.toThrow();
    });
    plotOptionsScenario('should not throw an error when lineColor is undefined', (ctx: any) => {
      const regions = [
        { fromDayOfWeek: 1, toDayOfWeek: 1, fill: true, fillColor: '#ffffff', line: true, colorMode: 'custom' },
      ];
      const from = dateTime('2018-01-01T00:00:00+01:00');
      const to = dateTime('2018-01-01T23:59:00+01:00');
      expect(() => ctx.setup(regions, from, to)).not.toThrow();
    });
  });

  describe('When creating plot markings using local time', () => {
    plotOptionsScenario('for day of week region', (ctx: any) => {
      const regions = [{ fromDayOfWeek: 1, toDayOfWeek: 1, fill: true, line: true, colorMode: 'red' }];
      const from = dateTime('2018-01-01T00:00:00+01:00');
      const to = dateTime('2018-01-01T23:59:00+01:00');
      ctx.setup(regions, from, to);

      it('should add 3 markings', () => {
        expect(ctx.options.grid.markings.length).toBe(3);
      });

      it('should add fill', () => {
        const markings = ctx.options.grid.markings;
        expect(dateTime(markings[0].xaxis.from).format()).toBe(dateTime('2018-01-01T01:00:00+01:00').format());
        expect(dateTime(markings[0].xaxis.to).format()).toBe(dateTime('2018-01-02T00:59:59+01:00').format());
        expect(markings[0].color).toBe(colorModes.red.color.fill);
      });

      it('should add line before', () => {
        const markings = ctx.options.grid.markings;
        expect(dateTime(markings[1].xaxis.from).format()).toBe(dateTime('2018-01-01T01:00:00+01:00').format());
        expect(dateTime(markings[1].xaxis.to).format()).toBe(dateTime('2018-01-01T01:00:00+01:00').format());
        expect(markings[1].color).toBe(colorModes.red.color.line);
      });

      it('should add line after', () => {
        const markings = ctx.options.grid.markings;
        expect(dateTime(markings[2].xaxis.from).format()).toBe(dateTime('2018-01-02T00:59:59+01:00').format());
        expect(dateTime(markings[2].xaxis.to).format()).toBe(dateTime('2018-01-02T00:59:59+01:00').format());
        expect(markings[2].color).toBe(colorModes.red.color.line);
      });
    });

    plotOptionsScenario('for time from region', (ctx: any) => {
      const regions = [{ from: '05:00', fill: true, colorMode: 'red' }];
      const from = dateTime('2018-01-01T00:00+01:00');
      const to = dateTime('2018-01-03T23:59+01:00');
      ctx.setup(regions, from, to);

      it('should add 3 markings', () => {
        expect(ctx.options.grid.markings.length).toBe(3);
      });

      it('should add one fill at 05:00 each day', () => {
        const markings = ctx.options.grid.markings;

        expect(dateTime(markings[0].xaxis.from).format()).toBe(dateTime('2018-01-01T06:00:00+01:00').format());
        expect(dateTime(markings[0].xaxis.to).format()).toBe(dateTime('2018-01-01T06:00:00+01:00').format());
        expect(markings[0].color).toBe(colorModes.red.color.fill);

        expect(dateTime(markings[1].xaxis.from).format()).toBe(dateTime('2018-01-02T06:00:00+01:00').format());
        expect(dateTime(markings[1].xaxis.to).format()).toBe(dateTime('2018-01-02T06:00:00+01:00').format());
        expect(markings[1].color).toBe(colorModes.red.color.fill);

        expect(dateTime(markings[2].xaxis.from).format()).toBe(dateTime('2018-01-03T06:00:00+01:00').format());
        expect(dateTime(markings[2].xaxis.to).format()).toBe(dateTime('2018-01-03T06:00:00+01:00').format());
        expect(markings[2].color).toBe(colorModes.red.color.fill);
      });
    });

    plotOptionsScenario('for time to region', (ctx: any) => {
      const regions = [{ to: '05:00', fill: true, colorMode: 'red' }];
      const from = dateTime('2018-02-01T00:00+01:00');
      const to = dateTime('2018-02-03T23:59+01:00');
      ctx.setup(regions, from, to);

      it('should add 3 markings', () => {
        expect(ctx.options.grid.markings.length).toBe(3);
      });

      it('should add one fill at 05:00 each day', () => {
        const markings = ctx.options.grid.markings;

        expect(dateTime(markings[0].xaxis.from).format()).toBe(dateTime('2018-02-01T06:00:00+01:00').format());
        expect(dateTime(markings[0].xaxis.to).format()).toBe(dateTime('2018-02-01T06:00:00+01:00').format());
        expect(markings[0].color).toBe(colorModes.red.color.fill);

        expect(dateTime(markings[1].xaxis.from).format()).toBe(dateTime('2018-02-02T06:00:00+01:00').format());
        expect(dateTime(markings[1].xaxis.to).format()).toBe(dateTime('2018-02-02T06:00:00+01:00').format());
        expect(markings[1].color).toBe(colorModes.red.color.fill);

        expect(dateTime(markings[2].xaxis.from).format()).toBe(dateTime('2018-02-03T06:00:00+01:00').format());
        expect(dateTime(markings[2].xaxis.to).format()).toBe(dateTime('2018-02-03T06:00:00+01:00').format());
        expect(markings[2].color).toBe(colorModes.red.color.fill);
      });
    });

    plotOptionsScenario('for time from/to region', (ctx: any) => {
      const regions = [{ from: '00:00', to: '05:00', fill: true, colorMode: 'red' }];
      const from = dateTime('2018-12-01T00:00+01:00');
      const to = dateTime('2018-12-03T23:59+01:00');
      ctx.setup(regions, from, to);

      it('should add 3 markings', () => {
        expect(ctx.options.grid.markings.length).toBe(3);
      });

      it('should add one fill between 00:00 and 05:00 each day', () => {
        const markings = ctx.options.grid.markings;

        expect(dateTime(markings[0].xaxis.from).format()).toBe(dateTime('2018-12-01T01:00:00+01:00').format());
        expect(dateTime(markings[0].xaxis.to).format()).toBe(dateTime('2018-12-01T06:00:00+01:00').format());
        expect(markings[0].color).toBe(colorModes.red.color.fill);

        expect(dateTime(markings[1].xaxis.from).format()).toBe(dateTime('2018-12-02T01:00:00+01:00').format());
        expect(dateTime(markings[1].xaxis.to).format()).toBe(dateTime('2018-12-02T06:00:00+01:00').format());
        expect(markings[1].color).toBe(colorModes.red.color.fill);

        expect(dateTime(markings[2].xaxis.from).format()).toBe(dateTime('2018-12-03T01:00:00+01:00').format());
        expect(dateTime(markings[2].xaxis.to).format()).toBe(dateTime('2018-12-03T06:00:00+01:00').format());
        expect(markings[2].color).toBe(colorModes.red.color.fill);
      });
    });

    plotOptionsScenario('for time from/to region crossing midnight', (ctx: any) => {
      const regions = [{ from: '22:00', to: '00:30', fill: true, colorMode: 'red' }];
      const from = dateTime('2018-12-01T12:00+01:00');
      const to = dateTime('2018-12-04T08:00+01:00');
      ctx.setup(regions, from, to);

      it('should add 3 markings', () => {
        expect(ctx.options.grid.markings.length).toBe(3);
      });

      it('should add one fill between 22:00 and 00:30 each day', () => {
        const markings = ctx.options.grid.markings;

        expect(dateTime(markings[0].xaxis.from).format()).toBe(dateTime('2018-12-01T23:00:00+01:00').format());
        expect(dateTime(markings[0].xaxis.to).format()).toBe(dateTime('2018-12-02T01:30:00+01:00').format());
        expect(markings[0].color).toBe(colorModes.red.color.fill);

        expect(dateTime(markings[1].xaxis.from).format()).toBe(dateTime('2018-12-02T23:00:00+01:00').format());
        expect(dateTime(markings[1].xaxis.to).format()).toBe(dateTime('2018-12-03T01:30:00+01:00').format());
        expect(markings[1].color).toBe(colorModes.red.color.fill);

        expect(dateTime(markings[2].xaxis.from).format()).toBe(dateTime('2018-12-03T23:00:00+01:00').format());
        expect(dateTime(markings[2].xaxis.to).format()).toBe(dateTime('2018-12-04T01:30:00+01:00').format());
        expect(markings[2].color).toBe(colorModes.red.color.fill);
      });
    });

    plotOptionsScenario('for day of week from/to region', (ctx: any) => {
      const regions = [{ fromDayOfWeek: 7, toDayOfWeek: 7, fill: true, colorMode: 'red' }];
      const from = dateTime('2018-01-01T18:45:05+01:00');
      const to = dateTime('2018-01-22T08:27:00+01:00');
      ctx.setup(regions, from, to);

      it('should add 3 markings', () => {
        expect(ctx.options.grid.markings.length).toBe(3);
      });

      it('should add one fill at each sunday', () => {
        const markings = ctx.options.grid.markings;

        expect(dateTime(markings[0].xaxis.from).format()).toBe(dateTime('2018-01-07T01:00:00+01:00').format());
        expect(dateTime(markings[0].xaxis.to).format()).toBe(dateTime('2018-01-08T00:59:59+01:00').format());
        expect(markings[0].color).toBe(colorModes.red.color.fill);

        expect(dateTime(markings[1].xaxis.from).format()).toBe(dateTime('2018-01-14T01:00:00+01:00').format());
        expect(dateTime(markings[1].xaxis.to).format()).toBe(dateTime('2018-01-15T00:59:59+01:00').format());
        expect(markings[1].color).toBe(colorModes.red.color.fill);

        expect(dateTime(markings[2].xaxis.from).format()).toBe(dateTime('2018-01-21T01:00:00+01:00').format());
        expect(dateTime(markings[2].xaxis.to).format()).toBe(dateTime('2018-01-22T00:59:59+01:00').format());
        expect(markings[2].color).toBe(colorModes.red.color.fill);
      });
    });

    plotOptionsScenario('for day of week from region', (ctx: any) => {
      const regions = [{ fromDayOfWeek: 7, fill: true, colorMode: 'red' }];
      const from = dateTime('2018-01-01T18:45:05+01:00');
      const to = dateTime('2018-01-22T08:27:00+01:00');
      ctx.setup(regions, from, to);

      it('should add 3 markings', () => {
        expect(ctx.options.grid.markings.length).toBe(3);
      });

      it('should add one fill at each sunday', () => {
        const markings = ctx.options.grid.markings;

        expect(dateTime(markings[0].xaxis.from).format()).toBe(dateTime('2018-01-07T01:00:00+01:00').format());
        expect(dateTime(markings[0].xaxis.to).format()).toBe(dateTime('2018-01-08T00:59:59+01:00').format());
        expect(markings[0].color).toBe(colorModes.red.color.fill);

        expect(dateTime(markings[1].xaxis.from).format()).toBe(dateTime('2018-01-14T01:00:00+01:00').format());
        expect(dateTime(markings[1].xaxis.to).format()).toBe(dateTime('2018-01-15T00:59:59+01:00').format());
        expect(markings[1].color).toBe(colorModes.red.color.fill);

        expect(dateTime(markings[2].xaxis.from).format()).toBe(dateTime('2018-01-21T01:00:00+01:00').format());
        expect(dateTime(markings[2].xaxis.to).format()).toBe(dateTime('2018-01-22T00:59:59+01:00').format());
        expect(markings[2].color).toBe(colorModes.red.color.fill);
      });
    });

    plotOptionsScenario('for day of week to region', (ctx: any) => {
      const regions = [{ toDayOfWeek: 7, fill: true, colorMode: 'red' }];
      const from = dateTime('2018-01-01T18:45:05+01:00');
      const to = dateTime('2018-01-22T08:27:00+01:00');
      ctx.setup(regions, from, to);

      it('should add 3 markings', () => {
        expect(ctx.options.grid.markings.length).toBe(3);
      });

      it('should add one fill at each sunday', () => {
        const markings = ctx.options.grid.markings;

        expect(dateTime(markings[0].xaxis.from).format()).toBe(dateTime('2018-01-07T01:00:00+01:00').format());
        expect(dateTime(markings[0].xaxis.to).format()).toBe(dateTime('2018-01-08T00:59:59+01:00').format());
        expect(markings[0].color).toBe(colorModes.red.color.fill);

        expect(dateTime(markings[1].xaxis.from).format()).toBe(dateTime('2018-01-14T01:00:00+01:00').format());
        expect(dateTime(markings[1].xaxis.to).format()).toBe(dateTime('2018-01-15T00:59:59+01:00').format());
        expect(markings[1].color).toBe(colorModes.red.color.fill);

        expect(dateTime(markings[2].xaxis.from).format()).toBe(dateTime('2018-01-21T01:00:00+01:00').format());
        expect(dateTime(markings[2].xaxis.to).format()).toBe(dateTime('2018-01-22T00:59:59+01:00').format());
        expect(markings[2].color).toBe(colorModes.red.color.fill);
      });
    });

    plotOptionsScenario('for day of week from/to time region', (ctx: any) => {
      const regions = [{ fromDayOfWeek: 7, from: '23:00', toDayOfWeek: 1, to: '01:40', fill: true, colorMode: 'red' }];
      const from = dateTime('2018-12-07T12:51:19+01:00');
      const to = dateTime('2018-12-10T13:51:29+01:00');
      ctx.setup(regions, from, to);

      it('should add 1 marking', () => {
        expect(ctx.options.grid.markings.length).toBe(1);
      });

      it('should add one fill between sunday 23:00 and monday 01:40', () => {
        const markings = ctx.options.grid.markings;

        expect(dateTime(markings[0].xaxis.from).format()).toBe(dateTime('2018-12-10T00:00:00+01:00').format());
        expect(dateTime(markings[0].xaxis.to).format()).toBe(dateTime('2018-12-10T02:40:00+01:00').format());
      });
    });

    plotOptionsScenario('for day of week from/to time region', (ctx: any) => {
      const regions = [{ fromDayOfWeek: 6, from: '03:00', toDayOfWeek: 7, to: '02:00', fill: true, colorMode: 'red' }];
      const from = dateTime('2018-12-07T12:51:19+01:00');
      const to = dateTime('2018-12-10T13:51:29+01:00');
      ctx.setup(regions, from, to);

      it('should add 1 marking', () => {
        expect(ctx.options.grid.markings.length).toBe(1);
      });

      it('should add one fill between saturday 03:00 and sunday 02:00', () => {
        const markings = ctx.options.grid.markings;

        expect(dateTime(markings[0].xaxis.from).format()).toBe(dateTime('2018-12-08T04:00:00+01:00').format());
        expect(dateTime(markings[0].xaxis.to).format()).toBe(dateTime('2018-12-09T03:00:00+01:00').format());
      });
    });

    plotOptionsScenario('for day of week from/to time region with daylight saving time', (ctx: any) => {
      const regions = [{ fromDayOfWeek: 7, from: '20:00', toDayOfWeek: 7, to: '23:00', fill: true, colorMode: 'red' }];
      const from = dateTime('2018-03-17T06:00:00+01:00');
      const to = dateTime('2018-04-03T06:00:00+02:00');
      ctx.setup(regions, from, to);

      it('should add 3 markings', () => {
        expect(ctx.options.grid.markings.length).toBe(3);
      });

      it('should add one fill at each sunday between 20:00 and 23:00', () => {
        const markings = ctx.options.grid.markings;

        expect(dateTime(markings[0].xaxis.from).format()).toBe(dateTime('2018-03-18T21:00:00+01:00').format());
        expect(dateTime(markings[0].xaxis.to).format()).toBe(dateTime('2018-03-19T00:00:00+01:00').format());

        expect(dateTime(markings[1].xaxis.from).format()).toBe(dateTime('2018-03-25T22:00:00+02:00').format());
        expect(dateTime(markings[1].xaxis.to).format()).toBe(dateTime('2018-03-26T01:00:00+02:00').format());

        expect(dateTime(markings[2].xaxis.from).format()).toBe(dateTime('2018-04-01T22:00:00+02:00').format());
        expect(dateTime(markings[2].xaxis.to).format()).toBe(dateTime('2018-04-02T01:00:00+02:00').format());
      });
    });

    plotOptionsScenario('for each day of week with winter time', (ctx: any) => {
      const regions = [{ fromDayOfWeek: 7, toDayOfWeek: 7, fill: true, colorMode: 'red' }];
      const from = dateTime('2018-10-20T14:50:11+02:00');
      const to = dateTime('2018-11-07T12:56:23+01:00');
      ctx.setup(regions, from, to);

      it('should add 3 markings', () => {
        expect(ctx.options.grid.markings.length).toBe(3);
      });

      it('should add one fill at each sunday', () => {
        const markings = ctx.options.grid.markings;

        expect(dateTime(markings[0].xaxis.from).format()).toBe(dateTime('2018-10-21T02:00:00+02:00').format());
        expect(dateTime(markings[0].xaxis.to).format()).toBe(dateTime('2018-10-22T01:59:59+02:00').format());

        expect(dateTime(markings[1].xaxis.from).format()).toBe(dateTime('2018-10-28T02:00:00+02:00').format());
        expect(dateTime(markings[1].xaxis.to).format()).toBe(dateTime('2018-10-29T00:59:59+01:00').format());

        expect(dateTime(markings[2].xaxis.from).format()).toBe(dateTime('2018-11-04T01:00:00+01:00').format());
        expect(dateTime(markings[2].xaxis.to).format()).toBe(dateTime('2018-11-05T00:59:59+01:00').format());
      });
    });
  });
});
