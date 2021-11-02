import { createTheme, FieldType, MutableDataFrame, toDataFrame } from '@grafana/data';
import { prepareGraphableFields } from './utils';
describe('prepare timeseries graph', function () {
    it('errors with no time fields', function () {
        var frames = [
            toDataFrame({
                fields: [
                    { name: 'a', values: [1, 2, 3] },
                    { name: 'b', values: ['a', 'b', 'c'] },
                ],
            }),
        ];
        var info = prepareGraphableFields(frames, createTheme());
        expect(info.warn).toEqual('Data does not have a time field');
    });
    it('requires a number or boolean value', function () {
        var frames = [
            toDataFrame({
                fields: [
                    { name: 'a', type: FieldType.time, values: [1, 2, 3] },
                    { name: 'b', values: ['a', 'b', 'c'] },
                ],
            }),
        ];
        var info = prepareGraphableFields(frames, createTheme());
        expect(info.warn).toEqual('No graphable fields');
    });
    it('will graph numbers and boolean values', function () {
        var frames = [
            toDataFrame({
                fields: [
                    { name: 'a', type: FieldType.time, values: [1, 2, 3] },
                    { name: 'b', values: ['a', 'b', 'c'] },
                    { name: 'c', values: [true, false, true] },
                    { name: 'd', values: [100, 200, 300] },
                ],
            }),
        ];
        var info = prepareGraphableFields(frames, createTheme());
        expect(info.warn).toBeUndefined();
        var out = info.frames[0];
        expect(out.fields.map(function (f) { return f.name; })).toEqual(['a', 'c', 'd']);
        var field = out.fields.find(function (f) { return f.name === 'c'; });
        expect(field === null || field === void 0 ? void 0 : field.display).toBeDefined();
        expect(field.display(1)).toMatchInlineSnapshot("\n      Object {\n        \"color\": \"#808080\",\n        \"numeric\": 1,\n        \"percent\": 1,\n        \"prefix\": undefined,\n        \"suffix\": undefined,\n        \"text\": \"True\",\n      }\n    ");
    });
    it('will convert NaN and Infinty to nulls', function () {
        var df = new MutableDataFrame({
            fields: [
                { name: 'time', type: FieldType.time, values: [995, 9996, 9997, 9998, 9999] },
                { name: 'a', values: [-10, NaN, 10, -Infinity, +Infinity] },
            ],
        });
        var result = prepareGraphableFields([df], createTheme());
        var field = result.frames[0].fields.find(function (f) { return f.name === 'a'; });
        expect(field.values.toArray()).toMatchInlineSnapshot("\n      Array [\n        -10,\n        null,\n        10,\n        null,\n        null,\n      ]\n    ");
    });
});
//# sourceMappingURL=utils.test.js.map