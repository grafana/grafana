import { __awaiter, __generator, __makeTemplateObject } from "tslib";
import { of } from 'rxjs';
import { queryBuilder } from '../shared/testing/builders';
import { FieldType, toDataFrame } from '@grafana/data';
import { updateVariableOptions } from './reducer';
import { areMetricFindValues, toMetricFindValues, updateOptionsState, validateVariableSelection } from './operators';
describe('operators', function () {
    beforeEach(function () {
        jest.clearAllMocks();
    });
    describe('validateVariableSelection', function () {
        describe('when called', function () {
            it('then the correct observable should be created', function () { return __awaiter(void 0, void 0, void 0, function () {
                var variable, dispatch, observable;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            variable = queryBuilder().withId('query').build();
                            dispatch = jest.fn().mockResolvedValue({});
                            observable = of(undefined).pipe(validateVariableSelection({ variable: variable, dispatch: dispatch }));
                            return [4 /*yield*/, expect(observable).toEmitValuesWith(function (received) {
                                    expect(received[0]).toEqual({});
                                    expect(dispatch).toHaveBeenCalledTimes(1);
                                })];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
        });
    });
    describe('updateOptionsState', function () {
        describe('when called', function () {
            it('then the correct observable should be created', function () { return __awaiter(void 0, void 0, void 0, function () {
                var variable, dispatch, getTemplatedRegexFunc, observable;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            variable = queryBuilder().withId('query').build();
                            dispatch = jest.fn();
                            getTemplatedRegexFunc = jest.fn().mockReturnValue('getTemplatedRegexFunc result');
                            observable = of([{ text: 'A' }]).pipe(updateOptionsState({ variable: variable, dispatch: dispatch, getTemplatedRegexFunc: getTemplatedRegexFunc }));
                            return [4 /*yield*/, expect(observable).toEmitValuesWith(function (received) {
                                    var value = received[0];
                                    expect(value).toEqual(undefined);
                                    expect(getTemplatedRegexFunc).toHaveBeenCalledTimes(1);
                                    expect(dispatch).toHaveBeenCalledTimes(1);
                                    expect(dispatch).toHaveBeenCalledWith(updateVariableOptions({
                                        id: 'query',
                                        type: 'query',
                                        data: { results: [{ text: 'A' }], templatedRegex: 'getTemplatedRegexFunc result' },
                                    }));
                                })];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
        });
    });
    describe('toMetricFindValues', function () {
        var frameWithTextField = toDataFrame({
            fields: [{ name: 'text', type: FieldType.string, values: ['A', 'B', 'C'] }],
        });
        var frameWithValueField = toDataFrame({
            fields: [{ name: 'value', type: FieldType.string, values: ['A', 'B', 'C'] }],
        });
        var frameWithTextAndValueField = toDataFrame({
            fields: [
                { name: 'text', type: FieldType.string, values: ['TA', 'TB', 'TC'] },
                { name: 'value', type: FieldType.string, values: ['VA', 'VB', 'VC'] },
            ],
        });
        var frameWithAStringField = toDataFrame({
            fields: [{ name: 'label', type: FieldType.string, values: ['A', 'B', 'C'] }],
        });
        var frameWithExpandableField = toDataFrame({
            fields: [
                { name: 'label', type: FieldType.string, values: ['A', 'B', 'C'] },
                { name: 'expandable', type: FieldType.boolean, values: [true, false, true] },
            ],
        });
        // it.each wouldn't work here as we need the done callback
        [
            { series: null, expected: [] },
            { series: undefined, expected: [] },
            { series: [], expected: [] },
            { series: [{ text: '' }], expected: [{ text: '' }] },
            { series: [{ value: '' }], expected: [{ value: '' }] },
            {
                series: [frameWithTextField],
                expected: [
                    { text: 'A', value: 'A' },
                    { text: 'B', value: 'B' },
                    { text: 'C', value: 'C' },
                ],
            },
            {
                series: [frameWithValueField],
                expected: [
                    { text: 'A', value: 'A' },
                    { text: 'B', value: 'B' },
                    { text: 'C', value: 'C' },
                ],
            },
            {
                series: [frameWithTextAndValueField],
                expected: [
                    { text: 'TA', value: 'VA' },
                    { text: 'TB', value: 'VB' },
                    { text: 'TC', value: 'VC' },
                ],
            },
            {
                series: [frameWithAStringField],
                expected: [
                    { text: 'A', value: 'A' },
                    { text: 'B', value: 'B' },
                    { text: 'C', value: 'C' },
                ],
            },
            {
                series: [frameWithExpandableField],
                expected: [
                    { text: 'A', value: 'A', expandable: true },
                    { text: 'B', value: 'B', expandable: false },
                    { text: 'C', value: 'C', expandable: true },
                ],
            },
        ].map(function (scenario) {
            it("when called with series:" + JSON.stringify(scenario.series, null, 0), function () { return __awaiter(void 0, void 0, void 0, function () {
                var series, expected, panelData, observable;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            series = scenario.series, expected = scenario.expected;
                            panelData = { series: series };
                            observable = of(panelData).pipe(toMetricFindValues());
                            return [4 /*yield*/, expect(observable).toEmitValuesWith(function (received) {
                                    var value = received[0];
                                    expect(value).toEqual(expected);
                                })];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe('when called without metric find values and string fields', function () {
            it('then the observable throws', function () { return __awaiter(void 0, void 0, void 0, function () {
                var frameWithTimeField, panelData, observable;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            frameWithTimeField = toDataFrame({
                                fields: [{ name: 'time', type: FieldType.time, values: [1, 2, 3] }],
                            });
                            panelData = { series: [frameWithTimeField] };
                            observable = of(panelData).pipe(toMetricFindValues());
                            return [4 /*yield*/, expect(observable).toEmitValuesWith(function (received) {
                                    var value = received[0];
                                    expect(value).toEqual(new Error("Couldn't find any field of type string in the results."));
                                })];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
        });
    });
});
describe('areMetricFindValues', function () {
    var frame = toDataFrame({
        fields: [{ name: 'text', type: FieldType.number, values: [1] }],
    });
    it.each(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    values                       | expected\n    ", "                      | ", "\n    ", "                 | ", "\n    ", "                   | ", "\n    ", "      | ", "\n    ", "    | ", "\n    ", " | ", "\n    ", "          | ", "\n    ", "          | ", "\n    ", "         | ", "\n    ", "                        | ", "\n    ", "            | ", "\n    ", "            | ", "\n    ", "           | ", "\n    ", "           | ", "\n    ", " | ", "\n    ", " | ", "\n    ", "             | ", "\n    ", "             | ", "\n    ", "            | ", "\n    ", "            | ", "\n    ", "   | ", "\n    ", "   | ", "\n  "], ["\n    values                       | expected\n    ", "                      | ", "\n    ", "                 | ", "\n    ", "                   | ", "\n    ", "      | ", "\n    ", "    | ", "\n    ", " | ", "\n    ", "          | ", "\n    ", "          | ", "\n    ", "         | ", "\n    ", "                        | ", "\n    ", "            | ", "\n    ", "            | ", "\n    ", "           | ", "\n    ", "           | ", "\n    ", " | ", "\n    ", " | ", "\n    ", "             | ", "\n    ", "             | ", "\n    ", "            | ", "\n    ", "            | ", "\n    ", "   | ", "\n    ", "   | ", "\n  "])), null, false, undefined, false, [frame], false, [{ text: function () { } }], false, [{ text: { foo: 1 } }], false, [{ text: Symbol('foo') }], false, [{ text: true }], false, [{ text: null }], true, [{ value: null }], true, [], true, [{ text: '' }], true, [{ Text: '' }], true, [{ value: '' }], true, [{ Value: '' }], true, [{ text: '', value: '' }], true, [{ Text: '', Value: '' }], true, [{ text: 1 }], true, [{ Text: 1 }], true, [{ value: 1 }], true, [{ Value: 1 }], true, [{ text: 1, value: 1 }], true, [{ Text: 1, Value: 1 }], true)('when called with values:$values', function (_a) {
        var values = _a.values, expected = _a.expected;
        expect(areMetricFindValues(values)).toBe(expected);
    });
});
var templateObject_1;
//# sourceMappingURL=operators.test.js.map