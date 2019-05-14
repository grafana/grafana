var _this = this;
import * as tslib_1 from "tslib";
import { StackdriverFilterCtrl } from '../query_filter_ctrl';
import { TemplateSrvStub } from 'test/specs/helpers';
import { DefaultRemoveFilterValue, DefaultFilterValue } from '../filter_segments';
describe('StackdriverQueryFilterCtrl', function () {
    var ctrl;
    var result;
    var groupByChangedMock;
    describe('when initializing query editor', function () {
        beforeEach(function () {
            var existingFilters = ['key1', '=', 'val1', 'AND', 'key2', '=', 'val2'];
            ctrl = createCtrlWithFakes(existingFilters);
        });
        it('should initialize filter segments using the target filter values', function () {
            expect(ctrl.filterSegments.filterSegments.length).toBe(8);
            expect(ctrl.filterSegments.filterSegments[0].type).toBe('key');
            expect(ctrl.filterSegments.filterSegments[1].type).toBe('operator');
            expect(ctrl.filterSegments.filterSegments[2].type).toBe('value');
            expect(ctrl.filterSegments.filterSegments[3].type).toBe('condition');
            expect(ctrl.filterSegments.filterSegments[4].type).toBe('key');
            expect(ctrl.filterSegments.filterSegments[5].type).toBe('operator');
            expect(ctrl.filterSegments.filterSegments[6].type).toBe('value');
            expect(ctrl.filterSegments.filterSegments[7].type).toBe('plus-button');
        });
    });
    describe('group bys', function () {
        beforeEach(function () {
            ctrl = createCtrlWithFakes();
        });
        describe('when labels are fetched', function () {
            beforeEach(function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                return tslib_1.__generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            ctrl.labelData.metricLabels = { 'metric-key-1': ['metric-value-1'] };
                            ctrl.labelData.resourceLabels = { 'resource-key-1': ['resource-value-1'] };
                            return [4 /*yield*/, ctrl.getGroupBys({ type: '' })];
                        case 1:
                            result = _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            it('should populate group bys segments', function () {
                expect(result.length).toBe(3);
                expect(result[0].value).toBe('metric.label.metric-key-1');
                expect(result[1].value).toBe('resource.label.resource-key-1');
                expect(result[2].value).toBe('-- remove group by --');
            });
        });
        describe('when a group by label is selected', function () {
            beforeEach(function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                return tslib_1.__generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            ctrl.labelData.metricLabels = {
                                'metric-key-1': ['metric-value-1'],
                                'metric-key-2': ['metric-value-2'],
                            };
                            ctrl.labelData.resourceLabels = {
                                'resource-key-1': ['resource-value-1'],
                                'resource-key-2': ['resource-value-2'],
                            };
                            ctrl.groupBys = ['metric.label.metric-key-1', 'resource.label.resource-key-1'];
                            return [4 /*yield*/, ctrl.getGroupBys({ type: '' })];
                        case 1:
                            result = _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            it('should not be used to populate group bys segments', function () {
                expect(result.length).toBe(3);
                expect(result[0].value).toBe('metric.label.metric-key-2');
                expect(result[1].value).toBe('resource.label.resource-key-2');
                expect(result[2].value).toBe('-- remove group by --');
            });
        });
        describe('when a group by is selected', function () {
            beforeEach(function () {
                groupByChangedMock = jest.fn();
                ctrl.groupBysChanged = groupByChangedMock;
                var removeSegment = { fake: true, value: '-- remove group by --' };
                var segment = { value: 'groupby1' };
                ctrl.groupBySegments = [segment, removeSegment];
                ctrl.groupByChanged(segment);
            });
            it('should be added to group bys list', function () {
                expect(groupByChangedMock).toHaveBeenCalledWith({ groupBys: ['groupby1'] });
            });
        });
        describe('when a selected group by is removed', function () {
            beforeEach(function () {
                groupByChangedMock = jest.fn();
                ctrl.groupBysChanged = groupByChangedMock;
                var removeSegment = { fake: true, value: '-- remove group by --' };
                var segment = { value: 'groupby1' };
                ctrl.groupBySegments = [segment, removeSegment];
                ctrl.groupByChanged(removeSegment);
            });
            it('should be added to group bys list', function () {
                expect(groupByChangedMock).toHaveBeenCalledWith({ groupBys: [] });
            });
        });
    });
    describe('filters', function () {
        beforeEach(function () {
            ctrl = createCtrlWithFakes();
        });
        describe('when values for a condition filter part are fetched', function () {
            beforeEach(function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                var segment;
                return tslib_1.__generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            segment = { type: 'condition' };
                            return [4 /*yield*/, ctrl.getFilters(segment, 0)];
                        case 1:
                            result = _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            it('should populate condition segments', function () {
                expect(result.length).toBe(1);
                expect(result[0].value).toBe('AND');
            });
        });
        describe('when values for a operator filter part are fetched', function () {
            beforeEach(function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                var segment;
                return tslib_1.__generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            segment = { type: 'operator' };
                            return [4 /*yield*/, ctrl.getFilters(segment, 0)];
                        case 1:
                            result = _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            it('should populate group bys segments', function () {
                expect(result.length).toBe(4);
                expect(result[0].value).toBe('=');
                expect(result[1].value).toBe('!=');
                expect(result[2].value).toBe('=~');
                expect(result[3].value).toBe('!=~');
            });
        });
        describe('when values for a key filter part are fetched', function () {
            beforeEach(function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                var segment;
                return tslib_1.__generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            ctrl.labelData.metricLabels = {
                                'metric-key-1': ['metric-value-1'],
                                'metric-key-2': ['metric-value-2'],
                            };
                            ctrl.labelData.resourceLabels = {
                                'resource-key-1': ['resource-value-1'],
                                'resource-key-2': ['resource-value-2'],
                            };
                            segment = { type: 'key' };
                            return [4 /*yield*/, ctrl.getFilters(segment, 0)];
                        case 1:
                            result = _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            it('should populate filter key segments', function () {
                expect(result.length).toBe(5);
                expect(result[0].value).toBe('metric.label.metric-key-1');
                expect(result[1].value).toBe('metric.label.metric-key-2');
                expect(result[2].value).toBe('resource.label.resource-key-1');
                expect(result[3].value).toBe('resource.label.resource-key-2');
                expect(result[4].value).toBe('-- remove filter --');
            });
        });
        describe('when values for a value filter part are fetched', function () {
            beforeEach(function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                var segment;
                return tslib_1.__generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            ctrl.labelData.metricLabels = {
                                'metric-key-1': ['metric-value-1'],
                                'metric-key-2': ['metric-value-2'],
                            };
                            ctrl.labelData.resourceLabels = {
                                'resource-key-1': ['resource-value-1'],
                                'resource-key-2': ['resource-value-2'],
                            };
                            ctrl.filterSegments.filterSegments = [
                                { type: 'key', value: 'metric.label.metric-key-1' },
                                { type: 'operator', value: '=' },
                            ];
                            segment = { type: 'value' };
                            return [4 /*yield*/, ctrl.getFilters(segment, 2)];
                        case 1:
                            result = _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            it('should populate filter value segments', function () {
                expect(result.length).toBe(1);
                expect(result[0].value).toBe('metric-value-1');
            });
        });
        describe('when a filter is created by clicking on plus button', function () {
            describe('and there are no other filters', function () {
                beforeEach(function () {
                    var segment = { value: 'filterkey1', type: 'plus-button' };
                    ctrl.filterSegments.filterSegments = [segment];
                    ctrl.filterSegmentUpdated(segment, 0);
                });
                it('should transform the plus button segment to a key segment', function () {
                    expect(ctrl.filterSegments.filterSegments[0].type).toBe('key');
                });
                it('should add an operator, value segment and plus button segment', function () {
                    expect(ctrl.filterSegments.filterSegments.length).toBe(3);
                    expect(ctrl.filterSegments.filterSegments[1].type).toBe('operator');
                    expect(ctrl.filterSegments.filterSegments[2].type).toBe('value');
                });
            });
        });
        describe('when has one existing filter', function () {
            describe('and user clicks on key segment', function () {
                beforeEach(function () {
                    var existingKeySegment = { value: 'filterkey1', type: 'key' };
                    var existingOperatorSegment = { value: '=', type: 'operator' };
                    var existingValueSegment = { value: 'filtervalue', type: 'value' };
                    var plusSegment = { value: '', type: 'plus-button' };
                    ctrl.filterSegments.filterSegments = [
                        existingKeySegment,
                        existingOperatorSegment,
                        existingValueSegment,
                        plusSegment,
                    ];
                    ctrl.filterSegmentUpdated(existingKeySegment, 0);
                });
                it('should not add any new segments', function () {
                    expect(ctrl.filterSegments.filterSegments.length).toBe(4);
                    expect(ctrl.filterSegments.filterSegments[0].type).toBe('key');
                    expect(ctrl.filterSegments.filterSegments[1].type).toBe('operator');
                    expect(ctrl.filterSegments.filterSegments[2].type).toBe('value');
                });
            });
            describe('and user clicks on value segment and value not equal to fake value', function () {
                beforeEach(function () {
                    var existingKeySegment = { value: 'filterkey1', type: 'key' };
                    var existingOperatorSegment = { value: '=', type: 'operator' };
                    var existingValueSegment = { value: 'filtervalue', type: 'value' };
                    ctrl.filterSegments.filterSegments = [existingKeySegment, existingOperatorSegment, existingValueSegment];
                    ctrl.filterSegmentUpdated(existingValueSegment, 2);
                });
                it('should ensure that plus segment exists', function () {
                    expect(ctrl.filterSegments.filterSegments.length).toBe(4);
                    expect(ctrl.filterSegments.filterSegments[0].type).toBe('key');
                    expect(ctrl.filterSegments.filterSegments[1].type).toBe('operator');
                    expect(ctrl.filterSegments.filterSegments[2].type).toBe('value');
                    expect(ctrl.filterSegments.filterSegments[3].type).toBe('plus-button');
                });
            });
            describe('and user clicks on value segment and value is equal to fake value', function () {
                beforeEach(function () {
                    var existingKeySegment = { value: 'filterkey1', type: 'key' };
                    var existingOperatorSegment = { value: '=', type: 'operator' };
                    var existingValueSegment = { value: DefaultFilterValue, type: 'value' };
                    ctrl.filterSegments.filterSegments = [existingKeySegment, existingOperatorSegment, existingValueSegment];
                    ctrl.filterSegmentUpdated(existingValueSegment, 2);
                });
                it('should not add plus segment', function () {
                    expect(ctrl.filterSegments.filterSegments.length).toBe(3);
                    expect(ctrl.filterSegments.filterSegments[0].type).toBe('key');
                    expect(ctrl.filterSegments.filterSegments[1].type).toBe('operator');
                    expect(ctrl.filterSegments.filterSegments[2].type).toBe('value');
                });
            });
            describe('and user removes key segment', function () {
                beforeEach(function () {
                    var existingKeySegment = { value: DefaultRemoveFilterValue, type: 'key' };
                    var existingOperatorSegment = { value: '=', type: 'operator' };
                    var existingValueSegment = { value: 'filtervalue', type: 'value' };
                    var plusSegment = { value: '', type: 'plus-button' };
                    ctrl.filterSegments.filterSegments = [
                        existingKeySegment,
                        existingOperatorSegment,
                        existingValueSegment,
                        plusSegment,
                    ];
                    ctrl.filterSegmentUpdated(existingKeySegment, 0);
                });
                it('should remove filter segments', function () {
                    expect(ctrl.filterSegments.filterSegments.length).toBe(1);
                    expect(ctrl.filterSegments.filterSegments[0].type).toBe('plus-button');
                });
            });
            describe('and user removes key segment and there is a previous filter', function () {
                beforeEach(function () {
                    var existingKeySegment1 = { value: DefaultRemoveFilterValue, type: 'key' };
                    var existingKeySegment2 = { value: DefaultRemoveFilterValue, type: 'key' };
                    var existingOperatorSegment = { value: '=', type: 'operator' };
                    var existingValueSegment = { value: 'filtervalue', type: 'value' };
                    var conditionSegment = { value: 'AND', type: 'condition' };
                    var plusSegment = { value: '', type: 'plus-button' };
                    ctrl.filterSegments.filterSegments = [
                        existingKeySegment1,
                        existingOperatorSegment,
                        existingValueSegment,
                        conditionSegment,
                        existingKeySegment2,
                        Object.assign({}, existingOperatorSegment),
                        Object.assign({}, existingValueSegment),
                        plusSegment,
                    ];
                    ctrl.filterSegmentUpdated(existingKeySegment2, 4);
                });
                it('should remove filter segments and the condition segment', function () {
                    expect(ctrl.filterSegments.filterSegments.length).toBe(4);
                    expect(ctrl.filterSegments.filterSegments[0].type).toBe('key');
                    expect(ctrl.filterSegments.filterSegments[1].type).toBe('operator');
                    expect(ctrl.filterSegments.filterSegments[2].type).toBe('value');
                    expect(ctrl.filterSegments.filterSegments[3].type).toBe('plus-button');
                });
            });
            describe('and user removes key segment and there is a filter after it', function () {
                beforeEach(function () {
                    var existingKeySegment1 = { value: DefaultRemoveFilterValue, type: 'key' };
                    var existingKeySegment2 = { value: DefaultRemoveFilterValue, type: 'key' };
                    var existingOperatorSegment = { value: '=', type: 'operator' };
                    var existingValueSegment = { value: 'filtervalue', type: 'value' };
                    var conditionSegment = { value: 'AND', type: 'condition' };
                    var plusSegment = { value: '', type: 'plus-button' };
                    ctrl.filterSegments.filterSegments = [
                        existingKeySegment1,
                        existingOperatorSegment,
                        existingValueSegment,
                        conditionSegment,
                        existingKeySegment2,
                        Object.assign({}, existingOperatorSegment),
                        Object.assign({}, existingValueSegment),
                        plusSegment,
                    ];
                    ctrl.filterSegmentUpdated(existingKeySegment1, 0);
                });
                it('should remove filter segments and the condition segment', function () {
                    expect(ctrl.filterSegments.filterSegments.length).toBe(4);
                    expect(ctrl.filterSegments.filterSegments[0].type).toBe('key');
                    expect(ctrl.filterSegments.filterSegments[1].type).toBe('operator');
                    expect(ctrl.filterSegments.filterSegments[2].type).toBe('value');
                    expect(ctrl.filterSegments.filterSegments[3].type).toBe('plus-button');
                });
            });
            describe('and user clicks on plus button', function () {
                beforeEach(function () {
                    var existingKeySegment = { value: 'filterkey1', type: 'key' };
                    var existingOperatorSegment = { value: '=', type: 'operator' };
                    var existingValueSegment = { value: 'filtervalue', type: 'value' };
                    var plusSegment = { value: 'filterkey2', type: 'plus-button' };
                    ctrl.filterSegments.filterSegments = [
                        existingKeySegment,
                        existingOperatorSegment,
                        existingValueSegment,
                        plusSegment,
                    ];
                    ctrl.filterSegmentUpdated(plusSegment, 3);
                });
                it('should condition segment and new filter segments', function () {
                    expect(ctrl.filterSegments.filterSegments.length).toBe(7);
                    expect(ctrl.filterSegments.filterSegments[0].type).toBe('key');
                    expect(ctrl.filterSegments.filterSegments[1].type).toBe('operator');
                    expect(ctrl.filterSegments.filterSegments[2].type).toBe('value');
                    expect(ctrl.filterSegments.filterSegments[3].type).toBe('condition');
                    expect(ctrl.filterSegments.filterSegments[4].type).toBe('key');
                    expect(ctrl.filterSegments.filterSegments[5].type).toBe('operator');
                    expect(ctrl.filterSegments.filterSegments[6].type).toBe('value');
                });
            });
        });
    });
});
function createCtrlWithFakes(existingFilters) {
    var fakeSegmentServer = {
        newKey: function (val) {
            return { value: val, type: 'key' };
        },
        newKeyValue: function (val) {
            return { value: val, type: 'value' };
        },
        newSegment: function (obj) {
            return { value: obj.value ? obj.value : obj };
        },
        newOperators: function (ops) {
            return ops.map(function (o) {
                return { type: 'operator', value: o };
            });
        },
        newFake: function (value, type, cssClass) {
            return { value: value, type: type, cssClass: cssClass };
        },
        newOperator: function (op) {
            return { value: op, type: 'operator' };
        },
        newPlusButton: function () {
            return { type: 'plus-button' };
        },
        newCondition: function (val) {
            return { type: 'condition', value: val };
        },
    };
    var scope = {
        hideGroupBys: false,
        groupBys: [],
        filters: existingFilters || [],
        labelData: {
            metricLabels: {},
            resourceLabels: {},
            resourceTypes: [],
        },
        filtersChanged: function () { },
        groupBysChanged: function () { },
        datasource: {
            getDefaultProject: function () {
                return 'project';
            },
        },
        refresh: function () { },
    };
    Object.assign(StackdriverFilterCtrl.prototype, scope);
    return new StackdriverFilterCtrl(scope, fakeSegmentServer, new TemplateSrvStub());
}
//# sourceMappingURL=query_filter_ctrl.test.js.map