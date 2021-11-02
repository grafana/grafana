import { hiddenReducerTypes, ThresholdMapper } from './ThresholdMapper';
import alertDef from './alertDef';
var visibleReducerTypes = alertDef.reducerTypes
    .filter(function (_a) {
    var value = _a.value;
    return hiddenReducerTypes.indexOf(value) === -1;
})
    .map(function (_a) {
    var value = _a.value;
    return value;
});
describe('ThresholdMapper', function () {
    describe('with greater than evaluator', function () {
        it('can map query conditions to thresholds', function () {
            var panel = {
                type: 'graph',
                options: { alertThresholds: true },
                alert: {
                    conditions: [
                        {
                            type: 'query',
                            evaluator: { type: 'gt', params: [100] },
                        },
                    ],
                },
            };
            var updated = ThresholdMapper.alertToGraphThresholds(panel);
            expect(updated).toBe(true);
            expect(panel.thresholds[0].op).toBe('gt');
            expect(panel.thresholds[0].value).toBe(100);
        });
    });
    describe('with outside range evaluator', function () {
        it('can map query conditions to thresholds', function () {
            var panel = {
                type: 'graph',
                options: { alertThresholds: true },
                alert: {
                    conditions: [
                        {
                            type: 'query',
                            evaluator: { type: 'outside_range', params: [100, 200] },
                        },
                    ],
                },
            };
            var updated = ThresholdMapper.alertToGraphThresholds(panel);
            expect(updated).toBe(true);
            expect(panel.thresholds[0].op).toBe('lt');
            expect(panel.thresholds[0].value).toBe(100);
            expect(panel.thresholds[1].op).toBe('gt');
            expect(panel.thresholds[1].value).toBe(200);
        });
    });
    describe('with inside range evaluator', function () {
        it('can map query conditions to thresholds', function () {
            var panel = {
                type: 'graph',
                options: { alertThresholds: true },
                alert: {
                    conditions: [
                        {
                            type: 'query',
                            evaluator: { type: 'within_range', params: [100, 200] },
                        },
                    ],
                },
            };
            var updated = ThresholdMapper.alertToGraphThresholds(panel);
            expect(updated).toBe(true);
            expect(panel.thresholds[0].op).toBe('gt');
            expect(panel.thresholds[0].value).toBe(100);
            expect(panel.thresholds[1].op).toBe('lt');
            expect(panel.thresholds[1].value).toBe(200);
        });
    });
    visibleReducerTypes.forEach(function (type) {
        describe("with {" + type + "} reducer", function () {
            it('visible should be true', function () {
                var panel = getPanel({ reducerType: type });
                var updated = ThresholdMapper.alertToGraphThresholds(panel);
                expect(updated).toBe(true);
                expect(panel.thresholds[0]).toEqual({
                    value: 100,
                    op: 'gt',
                    fill: true,
                    line: true,
                    colorMode: 'critical',
                    visible: true,
                });
            });
        });
    });
    hiddenReducerTypes.forEach(function (type) {
        describe("with {" + type + "} reducer", function () {
            it('visible should be false', function () {
                var panel = getPanel({ reducerType: type });
                var updated = ThresholdMapper.alertToGraphThresholds(panel);
                expect(updated).toBe(true);
                expect(panel.thresholds[0]).toEqual({
                    value: 100,
                    op: 'gt',
                    fill: true,
                    line: true,
                    colorMode: 'critical',
                    visible: false,
                });
            });
        });
    });
});
function getPanel(_a) {
    var _b = _a === void 0 ? {} : _a, reducerType = _b.reducerType;
    var panel = {
        type: 'graph',
        options: { alertThreshold: true },
        alert: {
            conditions: [
                {
                    type: 'query',
                    evaluator: { type: 'gt', params: [100] },
                    reducer: { type: reducerType },
                },
            ],
        },
    };
    return panel;
}
//# sourceMappingURL=ThresholdMapper.test.js.map