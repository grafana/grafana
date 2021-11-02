import { GraphCtrl } from '../module';
import { dateTime } from '@grafana/data';
jest.mock('../graph', function () { return ({}); });
describe.skip('GraphCtrl', function () {
    var injector = {
        get: function () {
            return {
                timeRange: function () {
                    return {
                        from: '',
                        to: '',
                    };
                },
            };
        },
    };
    GraphCtrl.prototype.panel = {
        events: {
            on: function () { },
            emit: function () { },
        },
        gridPos: {
            w: 100,
        },
        fieldConfig: {
            defaults: {},
        },
    };
    var scope = {
        $on: function () { },
        $parent: {
            panel: GraphCtrl.prototype.panel,
            dashboard: {},
        },
    };
    var ctx = {};
    beforeEach(function () {
        ctx.ctrl = new GraphCtrl(scope, injector);
        ctx.ctrl.events = {
            emit: function () { },
        };
        ctx.ctrl.panelData = {};
        ctx.ctrl.updateTimeRange();
    });
    describe('when time series are outside range', function () {
        beforeEach(function () {
            var data = [
                {
                    target: 'test.cpu1',
                    datapoints: [
                        [45, 1234567890],
                        [60, 1234567899],
                    ],
                },
            ];
            ctx.ctrl.range = { from: dateTime().valueOf(), to: dateTime().valueOf() };
            ctx.ctrl.onDataSnapshotLoad(data);
        });
        it('should set datapointsOutside', function () {
            expect(ctx.ctrl.dataWarning.title).toBe('Data outside time range');
        });
    });
    describe('when time series are inside range', function () {
        beforeEach(function () {
            var range = {
                from: dateTime().subtract(1, 'days').valueOf(),
                to: dateTime().valueOf(),
            };
            var data = [
                {
                    target: 'test.cpu1',
                    datapoints: [
                        [45, range.from + 1000],
                        [60, range.from + 10000],
                    ],
                },
            ];
            ctx.ctrl.range = range;
            ctx.ctrl.onDataSnapshotLoad(data);
        });
        it('should set datapointsOutside', function () {
            expect(ctx.ctrl.dataWarning).toBeUndefined();
        });
    });
    describe('datapointsCount given 2 series', function () {
        beforeEach(function () {
            var data = [
                { target: 'test.cpu1', datapoints: [] },
                { target: 'test.cpu2', datapoints: [] },
            ];
            ctx.ctrl.onDataSnapshotLoad(data);
        });
        it('should set datapointsCount warning', function () {
            expect(ctx.ctrl.dataWarning.title).toBe('No data');
        });
    });
    describe('when data is exported to CSV', function () {
        var appEventMock = jest.fn();
        beforeEach(function () {
            appEventMock.mockReset();
            scope.$root = { appEvent: appEventMock };
            scope.$new = function () { return ({}); };
            var data = [
                {
                    target: 'test.normal',
                    datapoints: [
                        [10, 1],
                        [10, 2],
                    ],
                },
                {
                    target: 'test.nulls',
                    datapoints: [
                        [null, 1],
                        [null, 2],
                    ],
                },
                {
                    target: 'test.zeros',
                    datapoints: [
                        [0, 1],
                        [0, 2],
                    ],
                },
            ];
            ctx.ctrl.onDataSnapshotLoad(data);
            // allIsNull / allIsZero are set by getFlotPairs
            ctx.ctrl.seriesList.forEach(function (series) { return series.getFlotPairs(''); });
        });
    });
});
//# sourceMappingURL=graph_ctrl.test.js.map