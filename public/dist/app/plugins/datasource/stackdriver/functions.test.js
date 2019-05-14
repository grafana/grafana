import { getAlignmentOptionsByMetric } from './functions';
import { ValueTypes, MetricKind } from './constants';
describe('functions', function () {
    var result;
    describe('getAlignmentOptionsByMetric', function () {
        describe('when double and gauge is passed', function () {
            beforeEach(function () {
                result = getAlignmentOptionsByMetric(ValueTypes.DOUBLE, MetricKind.GAUGE);
            });
            it('should return all alignment options except two', function () {
                expect(result.length).toBe(9);
                expect(result.map(function (o) { return o.value; })).toEqual(expect.not.arrayContaining(['REDUCE_COUNT_TRUE', 'REDUCE_COUNT_FALSE']));
            });
        });
        describe('when double and delta is passed', function () {
            beforeEach(function () {
                result = getAlignmentOptionsByMetric(ValueTypes.DOUBLE, MetricKind.DELTA);
            });
            it('should return all alignment options except four', function () {
                expect(result.length).toBe(9);
                expect(result.map(function (o) { return o.value; })).toEqual(expect.not.arrayContaining([
                    'ALIGN_COUNT_TRUE',
                    'ALIGN_COUNT_FALSE',
                    'ALIGN_FRACTION_TRUE',
                    'ALIGN_INTERPOLATE',
                ]));
            });
        });
    });
});
//# sourceMappingURL=functions.test.js.map