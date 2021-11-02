import { toDataFrame, FieldType } from '@grafana/data';
import { rowsToFields } from './rowsToFields';
describe('Rows to fields', function () {
    it('Will extract min & max from field', function () {
        var input = toDataFrame({
            fields: [
                { name: 'Name', type: FieldType.string, values: ['Temperature', 'Pressure'] },
                { name: 'Value', type: FieldType.number, values: [10, 200] },
                { name: 'Unit', type: FieldType.string, values: ['degree', 'pressurebar'] },
                { name: 'Miiin', type: FieldType.number, values: [3, 100] },
                { name: 'max', type: FieldType.string, values: [15, 200] },
            ],
        });
        var result = rowsToFields({
            mappings: [
                {
                    fieldName: 'Miiin',
                    handlerKey: 'min',
                },
            ],
        }, input);
        expect(result).toMatchInlineSnapshot("\n      Object {\n        \"fields\": Array [\n          Object {\n            \"config\": Object {\n              \"max\": 15,\n              \"min\": 3,\n              \"unit\": \"degree\",\n            },\n            \"labels\": Object {},\n            \"name\": \"Temperature\",\n            \"type\": \"number\",\n            \"values\": Array [\n              10,\n            ],\n          },\n          Object {\n            \"config\": Object {\n              \"max\": 200,\n              \"min\": 100,\n              \"unit\": \"pressurebar\",\n            },\n            \"labels\": Object {},\n            \"name\": \"Pressure\",\n            \"type\": \"number\",\n            \"values\": Array [\n              200,\n            ],\n          },\n        ],\n        \"length\": 1,\n      }\n    ");
    });
    it('Can handle custom name and value field mapping', function () {
        var input = toDataFrame({
            fields: [
                { name: 'Name', type: FieldType.string, values: ['Ignore'] },
                { name: 'SensorName', type: FieldType.string, values: ['Temperature'] },
                { name: 'Value', type: FieldType.number, values: [10] },
                { name: 'SensorReading', type: FieldType.number, values: [100] },
            ],
        });
        var result = rowsToFields({
            mappings: [
                { fieldName: 'SensorName', handlerKey: 'field.name' },
                { fieldName: 'SensorReading', handlerKey: 'field.value' },
            ],
        }, input);
        expect(result.fields[0].name).toBe('Temperature');
        expect(result.fields[0].config).toEqual({});
        expect(result.fields[0].values.get(0)).toBe(100);
    });
    it('Can handle colors', function () {
        var _a;
        var input = toDataFrame({
            fields: [
                { name: 'Name', type: FieldType.string, values: ['Temperature'] },
                { name: 'Value', type: FieldType.number, values: [10] },
                { name: 'Color', type: FieldType.string, values: ['blue'] },
            ],
        });
        var result = rowsToFields({}, input);
        expect((_a = result.fields[0].config.color) === null || _a === void 0 ? void 0 : _a.fixedColor).toBe('blue');
    });
    it('Can handle thresholds', function () {
        var _a;
        var input = toDataFrame({
            fields: [
                { name: 'Name', type: FieldType.string, values: ['Temperature'] },
                { name: 'Value', type: FieldType.number, values: [10] },
                { name: 'threshold1', type: FieldType.string, values: [30] },
                { name: 'threshold2', type: FieldType.string, values: [500] },
            ],
        });
        var result = rowsToFields({}, input);
        expect((_a = result.fields[0].config.thresholds) === null || _a === void 0 ? void 0 : _a.steps[1].value).toBe(30);
    });
    it('Will extract other string fields to labels', function () {
        var input = toDataFrame({
            fields: [
                { name: 'Name', type: FieldType.string, values: ['Temperature', 'Pressure'] },
                { name: 'Value', type: FieldType.number, values: [10, 200] },
                { name: 'City', type: FieldType.string, values: ['Stockholm', 'New York'] },
            ],
        });
        var result = rowsToFields({}, input);
        expect(result.fields[0].labels).toEqual({ City: 'Stockholm' });
        expect(result.fields[1].labels).toEqual({ City: 'New York' });
    });
    it('Can ignore field as auto picked for value or name', function () {
        var input = toDataFrame({
            fields: [
                { name: 'Name', type: FieldType.string, values: ['Temperature'] },
                { name: 'Value', type: FieldType.number, values: [10] },
                { name: 'City', type: FieldType.string, values: ['Stockholm'] },
                { name: 'Value2', type: FieldType.number, values: [20] },
            ],
        });
        var result = rowsToFields({
            mappings: [
                { fieldName: 'Name', handlerKey: '__ignore' },
                { fieldName: 'Value', handlerKey: '__ignore' },
            ],
        }, input);
        expect(result.fields[0].name).toEqual('Stockholm');
        expect(result.fields[0].values.get(0)).toEqual(20);
    });
    it('Can handle number fields as name field', function () {
        var input = toDataFrame({
            fields: [
                { name: 'SensorID', type: FieldType.number, values: [10, 20, 30] },
                { name: 'Value', type: FieldType.number, values: [1, 2, 3] },
            ],
        });
        var result = rowsToFields({
            mappings: [
                { fieldName: 'SensorID', handlerKey: 'field.name' },
                { fieldName: 'Value', handlerKey: 'field.value' },
            ],
        }, input);
        expect(result.fields[0].name).toEqual('10');
        expect(result.fields[0].values.get(0)).toEqual(1);
    });
});
//# sourceMappingURL=rowsToFields.test.js.map