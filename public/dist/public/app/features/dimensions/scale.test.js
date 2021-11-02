import { ArrayVector, FieldType } from '@grafana/data';
import { getScaledDimension, validateScaleConfig } from './scale';
describe('scale dimensions', function () {
    it('should validate empty input', function () {
        var out = validateScaleConfig({}, {
            min: 5,
            max: 10,
        });
        expect(out).toMatchInlineSnapshot("\n      Object {\n        \"fixed\": 7.5,\n        \"max\": 10,\n        \"min\": 5,\n      }\n    ");
    });
    it('should assert min<max', function () {
        var out = validateScaleConfig({
            max: -3,
            min: 7,
            fixed: 100,
        }, {
            min: 5,
            max: 10,
        });
        expect(out).toMatchInlineSnapshot("\n      Object {\n        \"fixed\": 10,\n        \"max\": 7,\n        \"min\": 5,\n      }\n    ");
    });
    it('should support negative min values', function () {
        var values = [-20, -10, -5, 0, 5, 10, 20];
        var frame = {
            name: 'a',
            length: values.length,
            fields: [
                { name: 'time', type: FieldType.number, values: new ArrayVector(values), config: {} },
                {
                    name: 'hello',
                    type: FieldType.number,
                    values: new ArrayVector(values),
                    config: {
                        min: -10,
                        max: 10,
                    },
                },
            ],
        };
        var supplier = getScaledDimension(frame, {
            min: -1,
            max: 1,
            field: 'hello',
            fixed: 0,
        });
        var scaled = frame.fields[0].values.toArray().map(function (k, i) { return supplier.get(i); });
        expect(scaled).toEqual([-1, -1, -0.5, 0, 0.5, 1, 1]);
    });
});
//# sourceMappingURL=scale.test.js.map