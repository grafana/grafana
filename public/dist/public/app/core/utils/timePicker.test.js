import { __assign } from "tslib";
import { toUtc } from '@grafana/data';
import { getShiftedTimeRange, getZoomedTimeRange } from './timePicker';
export var setup = function (options) {
    var defaultOptions = {
        range: {
            from: toUtc('2019-01-01 10:00:00'),
            to: toUtc('2019-01-01 16:00:00'),
            raw: {
                from: 'now-6h',
                to: 'now',
            },
        },
        direction: 0,
    };
    return __assign(__assign({}, defaultOptions), options);
};
describe('getShiftedTimeRange', function () {
    describe('when called with a direction of -1', function () {
        it('then it should return correct result', function () {
            var _a = setup({ direction: -1 }), range = _a.range, direction = _a.direction;
            var expectedRange = {
                from: toUtc('2019-01-01 07:00:00').valueOf(),
                to: toUtc('2019-01-01 13:00:00').valueOf(),
            };
            var result = getShiftedTimeRange(direction, range);
            expect(result).toEqual(expectedRange);
        });
    });
    describe('when called with a direction of 1', function () {
        it('then it should return correct result', function () {
            var _a = setup({ direction: 1 }), range = _a.range, direction = _a.direction;
            var expectedRange = {
                from: toUtc('2019-01-01 13:00:00').valueOf(),
                to: toUtc('2019-01-01 19:00:00').valueOf(),
            };
            var result = getShiftedTimeRange(direction, range);
            expect(result).toEqual(expectedRange);
        });
    });
    describe('when called with any other direction', function () {
        it('then it should return correct result', function () {
            var _a = setup({ direction: 0 }), range = _a.range, direction = _a.direction;
            var expectedRange = {
                from: toUtc('2019-01-01 10:00:00').valueOf(),
                to: toUtc('2019-01-01 16:00:00').valueOf(),
            };
            var result = getShiftedTimeRange(direction, range);
            expect(result).toEqual(expectedRange);
        });
    });
});
describe('getZoomedTimeRange', function () {
    describe('when called', function () {
        it('then it should return correct result', function () {
            var range = setup().range;
            var expectedRange = {
                from: toUtc('2019-01-01 07:00:00').valueOf(),
                to: toUtc('2019-01-01 19:00:00').valueOf(),
            };
            var result = getZoomedTimeRange(range, 2);
            expect(result).toEqual(expectedRange);
        });
    });
});
//# sourceMappingURL=timePicker.test.js.map