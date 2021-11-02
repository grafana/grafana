import { HeatmapCtrl } from '../heatmap_ctrl';
import { dateTime } from '@grafana/data';
describe('HeatmapCtrl', function () {
    var ctx = {};
    var $injector = {
        get: function () { },
    };
    HeatmapCtrl.prototype.panel = {
        events: {
            on: function () { },
            emit: function () { },
        },
    };
    var $scope = {
        $on: function () { },
        $parent: {
            panel: HeatmapCtrl.prototype.panel,
            dashboard: {},
        },
    };
    beforeEach(function () {
        //@ts-ignore
        ctx.ctrl = new HeatmapCtrl($scope, $injector, {});
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
            ctx.ctrl.onSnapshotLoad(data);
        });
        it('should set datapointsOutside', function () {
            expect(ctx.ctrl.dataWarning.title).toBe('Data points outside time range');
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
            ctx.ctrl.onSnapshotLoad(data);
        });
        it('should set datapointsOutside', function () {
            expect(ctx.ctrl.dataWarning).toBe(null);
        });
    });
    describe('datapointsCount given 2 series', function () {
        beforeEach(function () {
            var data = [
                { target: 'test.cpu1', datapoints: [] },
                { target: 'test.cpu2', datapoints: [] },
            ];
            ctx.ctrl.onSnapshotLoad(data);
        });
        it('should set datapointsCount warning', function () {
            expect(ctx.ctrl.dataWarning.title).toBe('No data points');
        });
    });
});
//# sourceMappingURL=heatmap_ctrl.test.js.map