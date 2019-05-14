import { TimeRegionManager, colorModes } from '../time_region_manager';
import moment from 'moment';
describe('TimeRegionManager', function () {
    function plotOptionsScenario(desc, func) {
        describe(desc, function () {
            var ctx = {
                panel: {
                    timeRegions: [],
                },
                options: {
                    grid: { markings: [] },
                },
                panelCtrl: {
                    range: {},
                    dashboard: {
                        isTimezoneUtc: function () { return false; },
                    },
                },
            };
            ctx.setup = function (regions, from, to) {
                ctx.panel.timeRegions = regions;
                ctx.panelCtrl.range.from = from;
                ctx.panelCtrl.range.to = to;
                var manager = new TimeRegionManager(ctx.panelCtrl);
                manager.addFlotOptions(ctx.options, ctx.panel);
            };
            ctx.printScenario = function () {
                console.log("Time range: from=" + ctx.panelCtrl.range.from.format() + ", to=" + ctx.panelCtrl.range.to.format(), ctx.panelCtrl.range.from._isUTC);
                ctx.options.grid.markings.forEach(function (m, i) {
                    console.log("Marking (" + i + "): from=" + moment(m.xaxis.from).format() + ", to=" + moment(m.xaxis.to).format() + ", color=" + m.color);
                });
            };
            func(ctx);
        });
    }
    describe('When colors missing in config', function () {
        plotOptionsScenario('should not throw an error when fillColor is undefined', function (ctx) {
            var regions = [
                { fromDayOfWeek: 1, toDayOfWeek: 1, fill: true, line: true, lineColor: '#ffffff', colorMode: 'custom' },
            ];
            var from = moment('2018-01-01T00:00:00+01:00');
            var to = moment('2018-01-01T23:59:00+01:00');
            expect(function () { return ctx.setup(regions, from, to); }).not.toThrow();
        });
        plotOptionsScenario('should not throw an error when lineColor is undefined', function (ctx) {
            var regions = [
                { fromDayOfWeek: 1, toDayOfWeek: 1, fill: true, fillColor: '#ffffff', line: true, colorMode: 'custom' },
            ];
            var from = moment('2018-01-01T00:00:00+01:00');
            var to = moment('2018-01-01T23:59:00+01:00');
            expect(function () { return ctx.setup(regions, from, to); }).not.toThrow();
        });
    });
    describe('When creating plot markings using local time', function () {
        plotOptionsScenario('for day of week region', function (ctx) {
            var regions = [{ fromDayOfWeek: 1, toDayOfWeek: 1, fill: true, line: true, colorMode: 'red' }];
            var from = moment('2018-01-01T00:00:00+01:00');
            var to = moment('2018-01-01T23:59:00+01:00');
            ctx.setup(regions, from, to);
            it('should add 3 markings', function () {
                expect(ctx.options.grid.markings.length).toBe(3);
            });
            it('should add fill', function () {
                var markings = ctx.options.grid.markings;
                expect(moment(markings[0].xaxis.from).format()).toBe(moment('2018-01-01T01:00:00+01:00').format());
                expect(moment(markings[0].xaxis.to).format()).toBe(moment('2018-01-02T00:59:59+01:00').format());
                expect(markings[0].color).toBe(colorModes.red.color.fill);
            });
            it('should add line before', function () {
                var markings = ctx.options.grid.markings;
                expect(moment(markings[1].xaxis.from).format()).toBe(moment('2018-01-01T01:00:00+01:00').format());
                expect(moment(markings[1].xaxis.to).format()).toBe(moment('2018-01-01T01:00:00+01:00').format());
                expect(markings[1].color).toBe(colorModes.red.color.line);
            });
            it('should add line after', function () {
                var markings = ctx.options.grid.markings;
                expect(moment(markings[2].xaxis.from).format()).toBe(moment('2018-01-02T00:59:59+01:00').format());
                expect(moment(markings[2].xaxis.to).format()).toBe(moment('2018-01-02T00:59:59+01:00').format());
                expect(markings[2].color).toBe(colorModes.red.color.line);
            });
        });
        plotOptionsScenario('for time from region', function (ctx) {
            var regions = [{ from: '05:00', fill: true, colorMode: 'red' }];
            var from = moment('2018-01-01T00:00+01:00');
            var to = moment('2018-01-03T23:59+01:00');
            ctx.setup(regions, from, to);
            it('should add 3 markings', function () {
                expect(ctx.options.grid.markings.length).toBe(3);
            });
            it('should add one fill at 05:00 each day', function () {
                var markings = ctx.options.grid.markings;
                expect(moment(markings[0].xaxis.from).format()).toBe(moment('2018-01-01T06:00:00+01:00').format());
                expect(moment(markings[0].xaxis.to).format()).toBe(moment('2018-01-01T06:00:00+01:00').format());
                expect(markings[0].color).toBe(colorModes.red.color.fill);
                expect(moment(markings[1].xaxis.from).format()).toBe(moment('2018-01-02T06:00:00+01:00').format());
                expect(moment(markings[1].xaxis.to).format()).toBe(moment('2018-01-02T06:00:00+01:00').format());
                expect(markings[1].color).toBe(colorModes.red.color.fill);
                expect(moment(markings[2].xaxis.from).format()).toBe(moment('2018-01-03T06:00:00+01:00').format());
                expect(moment(markings[2].xaxis.to).format()).toBe(moment('2018-01-03T06:00:00+01:00').format());
                expect(markings[2].color).toBe(colorModes.red.color.fill);
            });
        });
        plotOptionsScenario('for time to region', function (ctx) {
            var regions = [{ to: '05:00', fill: true, colorMode: 'red' }];
            var from = moment('2018-02-01T00:00+01:00');
            var to = moment('2018-02-03T23:59+01:00');
            ctx.setup(regions, from, to);
            it('should add 3 markings', function () {
                expect(ctx.options.grid.markings.length).toBe(3);
            });
            it('should add one fill at 05:00 each day', function () {
                var markings = ctx.options.grid.markings;
                expect(moment(markings[0].xaxis.from).format()).toBe(moment('2018-02-01T06:00:00+01:00').format());
                expect(moment(markings[0].xaxis.to).format()).toBe(moment('2018-02-01T06:00:00+01:00').format());
                expect(markings[0].color).toBe(colorModes.red.color.fill);
                expect(moment(markings[1].xaxis.from).format()).toBe(moment('2018-02-02T06:00:00+01:00').format());
                expect(moment(markings[1].xaxis.to).format()).toBe(moment('2018-02-02T06:00:00+01:00').format());
                expect(markings[1].color).toBe(colorModes.red.color.fill);
                expect(moment(markings[2].xaxis.from).format()).toBe(moment('2018-02-03T06:00:00+01:00').format());
                expect(moment(markings[2].xaxis.to).format()).toBe(moment('2018-02-03T06:00:00+01:00').format());
                expect(markings[2].color).toBe(colorModes.red.color.fill);
            });
        });
        plotOptionsScenario('for time from/to region', function (ctx) {
            var regions = [{ from: '00:00', to: '05:00', fill: true, colorMode: 'red' }];
            var from = moment('2018-12-01T00:00+01:00');
            var to = moment('2018-12-03T23:59+01:00');
            ctx.setup(regions, from, to);
            it('should add 3 markings', function () {
                expect(ctx.options.grid.markings.length).toBe(3);
            });
            it('should add one fill between 00:00 and 05:00 each day', function () {
                var markings = ctx.options.grid.markings;
                expect(moment(markings[0].xaxis.from).format()).toBe(moment('2018-12-01T01:00:00+01:00').format());
                expect(moment(markings[0].xaxis.to).format()).toBe(moment('2018-12-01T06:00:00+01:00').format());
                expect(markings[0].color).toBe(colorModes.red.color.fill);
                expect(moment(markings[1].xaxis.from).format()).toBe(moment('2018-12-02T01:00:00+01:00').format());
                expect(moment(markings[1].xaxis.to).format()).toBe(moment('2018-12-02T06:00:00+01:00').format());
                expect(markings[1].color).toBe(colorModes.red.color.fill);
                expect(moment(markings[2].xaxis.from).format()).toBe(moment('2018-12-03T01:00:00+01:00').format());
                expect(moment(markings[2].xaxis.to).format()).toBe(moment('2018-12-03T06:00:00+01:00').format());
                expect(markings[2].color).toBe(colorModes.red.color.fill);
            });
        });
        plotOptionsScenario('for day of week from/to region', function (ctx) {
            var regions = [{ fromDayOfWeek: 7, toDayOfWeek: 7, fill: true, colorMode: 'red' }];
            var from = moment('2018-01-01T18:45:05+01:00');
            var to = moment('2018-01-22T08:27:00+01:00');
            ctx.setup(regions, from, to);
            it('should add 3 markings', function () {
                expect(ctx.options.grid.markings.length).toBe(3);
            });
            it('should add one fill at each sunday', function () {
                var markings = ctx.options.grid.markings;
                expect(moment(markings[0].xaxis.from).format()).toBe(moment('2018-01-07T01:00:00+01:00').format());
                expect(moment(markings[0].xaxis.to).format()).toBe(moment('2018-01-08T00:59:59+01:00').format());
                expect(markings[0].color).toBe(colorModes.red.color.fill);
                expect(moment(markings[1].xaxis.from).format()).toBe(moment('2018-01-14T01:00:00+01:00').format());
                expect(moment(markings[1].xaxis.to).format()).toBe(moment('2018-01-15T00:59:59+01:00').format());
                expect(markings[1].color).toBe(colorModes.red.color.fill);
                expect(moment(markings[2].xaxis.from).format()).toBe(moment('2018-01-21T01:00:00+01:00').format());
                expect(moment(markings[2].xaxis.to).format()).toBe(moment('2018-01-22T00:59:59+01:00').format());
                expect(markings[2].color).toBe(colorModes.red.color.fill);
            });
        });
        plotOptionsScenario('for day of week from region', function (ctx) {
            var regions = [{ fromDayOfWeek: 7, fill: true, colorMode: 'red' }];
            var from = moment('2018-01-01T18:45:05+01:00');
            var to = moment('2018-01-22T08:27:00+01:00');
            ctx.setup(regions, from, to);
            it('should add 3 markings', function () {
                expect(ctx.options.grid.markings.length).toBe(3);
            });
            it('should add one fill at each sunday', function () {
                var markings = ctx.options.grid.markings;
                expect(moment(markings[0].xaxis.from).format()).toBe(moment('2018-01-07T01:00:00+01:00').format());
                expect(moment(markings[0].xaxis.to).format()).toBe(moment('2018-01-08T00:59:59+01:00').format());
                expect(markings[0].color).toBe(colorModes.red.color.fill);
                expect(moment(markings[1].xaxis.from).format()).toBe(moment('2018-01-14T01:00:00+01:00').format());
                expect(moment(markings[1].xaxis.to).format()).toBe(moment('2018-01-15T00:59:59+01:00').format());
                expect(markings[1].color).toBe(colorModes.red.color.fill);
                expect(moment(markings[2].xaxis.from).format()).toBe(moment('2018-01-21T01:00:00+01:00').format());
                expect(moment(markings[2].xaxis.to).format()).toBe(moment('2018-01-22T00:59:59+01:00').format());
                expect(markings[2].color).toBe(colorModes.red.color.fill);
            });
        });
        plotOptionsScenario('for day of week to region', function (ctx) {
            var regions = [{ toDayOfWeek: 7, fill: true, colorMode: 'red' }];
            var from = moment('2018-01-01T18:45:05+01:00');
            var to = moment('2018-01-22T08:27:00+01:00');
            ctx.setup(regions, from, to);
            it('should add 3 markings', function () {
                expect(ctx.options.grid.markings.length).toBe(3);
            });
            it('should add one fill at each sunday', function () {
                var markings = ctx.options.grid.markings;
                expect(moment(markings[0].xaxis.from).format()).toBe(moment('2018-01-07T01:00:00+01:00').format());
                expect(moment(markings[0].xaxis.to).format()).toBe(moment('2018-01-08T00:59:59+01:00').format());
                expect(markings[0].color).toBe(colorModes.red.color.fill);
                expect(moment(markings[1].xaxis.from).format()).toBe(moment('2018-01-14T01:00:00+01:00').format());
                expect(moment(markings[1].xaxis.to).format()).toBe(moment('2018-01-15T00:59:59+01:00').format());
                expect(markings[1].color).toBe(colorModes.red.color.fill);
                expect(moment(markings[2].xaxis.from).format()).toBe(moment('2018-01-21T01:00:00+01:00').format());
                expect(moment(markings[2].xaxis.to).format()).toBe(moment('2018-01-22T00:59:59+01:00').format());
                expect(markings[2].color).toBe(colorModes.red.color.fill);
            });
        });
        plotOptionsScenario('for day of week from/to time region', function (ctx) {
            var regions = [{ fromDayOfWeek: 7, from: '23:00', toDayOfWeek: 1, to: '01:40', fill: true, colorMode: 'red' }];
            var from = moment('2018-12-07T12:51:19+01:00');
            var to = moment('2018-12-10T13:51:29+01:00');
            ctx.setup(regions, from, to);
            it('should add 1 marking', function () {
                expect(ctx.options.grid.markings.length).toBe(1);
            });
            it('should add one fill between sunday 23:00 and monday 01:40', function () {
                var markings = ctx.options.grid.markings;
                expect(moment(markings[0].xaxis.from).format()).toBe(moment('2018-12-10T00:00:00+01:00').format());
                expect(moment(markings[0].xaxis.to).format()).toBe(moment('2018-12-10T02:40:00+01:00').format());
            });
        });
        plotOptionsScenario('for day of week from/to time region', function (ctx) {
            var regions = [{ fromDayOfWeek: 6, from: '03:00', toDayOfWeek: 7, to: '02:00', fill: true, colorMode: 'red' }];
            var from = moment('2018-12-07T12:51:19+01:00');
            var to = moment('2018-12-10T13:51:29+01:00');
            ctx.setup(regions, from, to);
            it('should add 1 marking', function () {
                expect(ctx.options.grid.markings.length).toBe(1);
            });
            it('should add one fill between saturday 03:00 and sunday 02:00', function () {
                var markings = ctx.options.grid.markings;
                expect(moment(markings[0].xaxis.from).format()).toBe(moment('2018-12-08T04:00:00+01:00').format());
                expect(moment(markings[0].xaxis.to).format()).toBe(moment('2018-12-09T03:00:00+01:00').format());
            });
        });
        plotOptionsScenario('for day of week from/to time region with daylight saving time', function (ctx) {
            var regions = [{ fromDayOfWeek: 7, from: '20:00', toDayOfWeek: 7, to: '23:00', fill: true, colorMode: 'red' }];
            var from = moment('2018-03-17T06:00:00+01:00');
            var to = moment('2018-04-03T06:00:00+02:00');
            ctx.setup(regions, from, to);
            it('should add 3 markings', function () {
                expect(ctx.options.grid.markings.length).toBe(3);
            });
            it('should add one fill at each sunday between 20:00 and 23:00', function () {
                var markings = ctx.options.grid.markings;
                expect(moment(markings[0].xaxis.from).format()).toBe(moment('2018-03-18T21:00:00+01:00').format());
                expect(moment(markings[0].xaxis.to).format()).toBe(moment('2018-03-19T00:00:00+01:00').format());
                expect(moment(markings[1].xaxis.from).format()).toBe(moment('2018-03-25T22:00:00+02:00').format());
                expect(moment(markings[1].xaxis.to).format()).toBe(moment('2018-03-26T01:00:00+02:00').format());
                expect(moment(markings[2].xaxis.from).format()).toBe(moment('2018-04-01T22:00:00+02:00').format());
                expect(moment(markings[2].xaxis.to).format()).toBe(moment('2018-04-02T01:00:00+02:00').format());
            });
        });
        plotOptionsScenario('for each day of week with winter time', function (ctx) {
            var regions = [{ fromDayOfWeek: 7, toDayOfWeek: 7, fill: true, colorMode: 'red' }];
            var from = moment('2018-10-20T14:50:11+02:00');
            var to = moment('2018-11-07T12:56:23+01:00');
            ctx.setup(regions, from, to);
            it('should add 3 markings', function () {
                expect(ctx.options.grid.markings.length).toBe(3);
            });
            it('should add one fill at each sunday', function () {
                var markings = ctx.options.grid.markings;
                expect(moment(markings[0].xaxis.from).format()).toBe(moment('2018-10-21T02:00:00+02:00').format());
                expect(moment(markings[0].xaxis.to).format()).toBe(moment('2018-10-22T01:59:59+02:00').format());
                expect(moment(markings[1].xaxis.from).format()).toBe(moment('2018-10-28T02:00:00+02:00').format());
                expect(moment(markings[1].xaxis.to).format()).toBe(moment('2018-10-29T00:59:59+01:00').format());
                expect(moment(markings[2].xaxis.from).format()).toBe(moment('2018-11-04T01:00:00+01:00').format());
                expect(moment(markings[2].xaxis.to).format()).toBe(moment('2018-11-05T00:59:59+01:00').format());
            });
        });
    });
});
//# sourceMappingURL=time_region_manager.test.js.map