import { ArrayVector, createTheme, FieldType, ThresholdsMode, toDataFrame } from '@grafana/data';
import { LegendDisplayMode } from '@grafana/schema';
import { findNextStateIndex, getThresholdItems, prepareTimelineFields, prepareTimelineLegendItems } from './utils';
var theme = createTheme();
describe('prepare timeline graph', function () {
    it('errors with no time fields', function () {
        var frames = [
            toDataFrame({
                fields: [
                    { name: 'a', values: [1, 2, 3] },
                    { name: 'b', values: ['a', 'b', 'c'] },
                ],
            }),
        ];
        var info = prepareTimelineFields(frames, true, theme);
        expect(info.warn).toEqual('Data does not have a time field');
    });
    it('requires a number, string, or boolean value', function () {
        var frames = [
            toDataFrame({
                fields: [
                    { name: 'a', type: FieldType.time, values: [1, 2, 3] },
                    { name: 'b', type: FieldType.other, values: [{}, {}, {}] },
                ],
            }),
        ];
        var info = prepareTimelineFields(frames, true, theme);
        expect(info.warn).toEqual('No graphable fields');
    });
    it('will merge duplicate values', function () {
        var frames = [
            toDataFrame({
                fields: [
                    { name: 'a', type: FieldType.time, values: [1, 2, 3, 4, 5, 6, 7] },
                    { name: 'b', values: [1, 1, undefined, 1, 2, 2, null, 2, 3] },
                ],
            }),
        ];
        var info = prepareTimelineFields(frames, true, theme);
        expect(info.warn).toBeUndefined();
        var out = info.frames[0];
        var field = out.fields.find(function (f) { return f.name === 'b'; });
        expect(field === null || field === void 0 ? void 0 : field.values.toArray()).toMatchInlineSnapshot("\n      Array [\n        1,\n        undefined,\n        undefined,\n        undefined,\n        2,\n        undefined,\n        null,\n        2,\n        3,\n      ]\n    ");
    });
});
describe('findNextStateIndex', function () {
    it('handles leading datapoint index', function () {
        var field = {
            name: 'time',
            type: FieldType.number,
            values: new ArrayVector([1, undefined, undefined, 2, undefined, undefined]),
        };
        var result = findNextStateIndex(field, 0);
        expect(result).toEqual(3);
    });
    it('handles trailing datapoint index', function () {
        var field = {
            name: 'time',
            type: FieldType.number,
            values: new ArrayVector([1, undefined, undefined, 2, undefined, 3]),
        };
        var result = findNextStateIndex(field, 5);
        expect(result).toEqual(null);
    });
    it('handles trailing undefined', function () {
        var field = {
            name: 'time',
            type: FieldType.number,
            values: new ArrayVector([1, undefined, undefined, 2, undefined, 3, undefined]),
        };
        var result = findNextStateIndex(field, 5);
        expect(result).toEqual(null);
    });
    it('handles datapoint index inside range', function () {
        var field = {
            name: 'time',
            type: FieldType.number,
            values: new ArrayVector([
                1,
                undefined,
                undefined,
                3,
                undefined,
                undefined,
                undefined,
                undefined,
                2,
                undefined,
                undefined,
            ]),
        };
        var result = findNextStateIndex(field, 3);
        expect(result).toEqual(8);
    });
    describe('single data points', function () {
        var field = {
            name: 'time',
            type: FieldType.number,
            values: new ArrayVector([1, 3, 2]),
        };
        test('leading', function () {
            var result = findNextStateIndex(field, 0);
            expect(result).toEqual(1);
        });
        test('trailing', function () {
            var result = findNextStateIndex(field, 2);
            expect(result).toEqual(null);
        });
        test('inside', function () {
            var result = findNextStateIndex(field, 1);
            expect(result).toEqual(2);
        });
    });
});
describe('getThresholdItems', function () {
    it('should handle only one threshold', function () {
        var result = getThresholdItems({ thresholds: { mode: ThresholdsMode.Absolute, steps: [{ color: 'black', value: 0 }] } }, theme);
        expect(result).toHaveLength(1);
    });
});
describe('prepareTimelineLegendItems', function () {
    it('should return legend items', function () {
        var frame = [
            {
                refId: 'A',
                fields: [
                    {
                        name: 'time',
                        config: {
                            color: {
                                mode: 'thresholds',
                            },
                            thresholds: {
                                mode: 'absolute',
                                steps: [
                                    {
                                        color: 'green',
                                        value: null,
                                    },
                                ],
                            },
                        },
                        values: new ArrayVector([
                            1634092733455,
                            1634092763455,
                            1634092793455,
                            1634092823455,
                            1634092853455,
                            1634092883455,
                            1634092913455,
                            1634092943455,
                            1634092973455,
                            1634093003455,
                        ]),
                        display: function (value) { return ({
                            text: value,
                            color: undefined,
                            numeric: NaN,
                        }); },
                    },
                    {
                        name: 'A-series',
                        config: {
                            color: {
                                mode: 'thresholds',
                            },
                            thresholds: {
                                mode: 'absolute',
                                steps: [
                                    {
                                        color: 'green',
                                        value: null,
                                    },
                                ],
                            },
                        },
                        values: new ArrayVector(['< -∞', null, null, null, null, null, null, null, null, null]),
                        display: function (value) { return ({
                            text: value || '',
                            color: 'green',
                            numeric: NaN,
                        }); },
                    },
                ],
            },
        ];
        var result = prepareTimelineLegendItems(frame, { displayMode: LegendDisplayMode.List }, theme);
        expect(result).toHaveLength(1);
    });
});
//# sourceMappingURL=utils.test.js.map