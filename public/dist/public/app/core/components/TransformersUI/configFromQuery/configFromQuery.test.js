import { toDataFrame, FieldType, ReducerID } from '@grafana/data';
import { FieldConfigHandlerKey } from '../fieldToConfigMapping/fieldToConfigMapping';
import { extractConfigFromQuery } from './configFromQuery';
describe('config from data', function () {
    var config = toDataFrame({
        fields: [
            { name: 'Time', type: FieldType.time, values: [1, 2] },
            { name: 'Max', type: FieldType.number, values: [1, 10, 50] },
            { name: 'Min', type: FieldType.number, values: [1, 10, 5] },
            { name: 'Names', type: FieldType.string, values: ['first-name', 'middle', 'last-name'] },
        ],
        refId: 'A',
    });
    var seriesA = toDataFrame({
        fields: [
            { name: 'Time', type: FieldType.time, values: [1, 2, 3] },
            {
                name: 'Value',
                type: FieldType.number,
                values: [2, 3, 4],
                config: { displayName: 'SeriesA' },
            },
        ],
    });
    it('Select and apply with two frames and default mappings and reducer', function () {
        var options = {
            configRefId: 'A',
            mappings: [],
        };
        var results = extractConfigFromQuery(options, [config, seriesA]);
        expect(results.length).toBe(1);
        expect(results[0].fields[1].config.max).toBe(50);
        expect(results[0].fields[1].config.min).toBe(5);
    });
    it('Can apply to config frame if there is only one frame', function () {
        var options = {
            configRefId: 'A',
            mappings: [],
        };
        var results = extractConfigFromQuery(options, [config]);
        expect(results.length).toBe(1);
        expect(results[0].fields[1].name).toBe('Max');
        expect(results[0].fields[1].config.max).toBe(50);
    });
    it('With ignore mappings', function () {
        var options = {
            configRefId: 'A',
            mappings: [{ fieldName: 'Min', handlerKey: FieldConfigHandlerKey.Ignore }],
        };
        var results = extractConfigFromQuery(options, [config, seriesA]);
        expect(results.length).toBe(1);
        expect(results[0].fields[1].config.min).toEqual(undefined);
        expect(results[0].fields[1].config.max).toEqual(50);
    });
    it('With custom mappings', function () {
        var options = {
            configRefId: 'A',
            mappings: [{ fieldName: 'Min', handlerKey: 'decimals' }],
        };
        var results = extractConfigFromQuery(options, [config, seriesA]);
        expect(results.length).toBe(1);
        expect(results[0].fields[1].config.decimals).toBe(5);
    });
    it('With custom reducer', function () {
        var options = {
            configRefId: 'A',
            mappings: [{ fieldName: 'Max', handlerKey: 'max', reducerId: ReducerID.min }],
        };
        var results = extractConfigFromQuery(options, [config, seriesA]);
        expect(results.length).toBe(1);
        expect(results[0].fields[1].config.max).toBe(1);
    });
    it('With custom matcher and displayName mapping', function () {
        var options = {
            configRefId: 'A',
            mappings: [{ fieldName: 'Names', handlerKey: 'displayName', reducerId: ReducerID.first }],
            applyTo: { id: 'byName', options: 'Value' },
        };
        var results = extractConfigFromQuery(options, [config, seriesA]);
        expect(results.length).toBe(1);
        expect(results[0].fields[1].config.displayName).toBe('first-name');
    });
});
describe('value mapping from data', function () {
    var config = toDataFrame({
        fields: [
            { name: 'value', type: FieldType.number, values: [1, 2, 3] },
            { name: 'text', type: FieldType.string, values: ['one', 'two', 'three'] },
            { name: 'color', type: FieldType.string, values: ['red', 'blue', 'green'] },
        ],
        refId: 'config',
    });
    var seriesA = toDataFrame({
        fields: [
            { name: 'Time', type: FieldType.time, values: [1, 2, 3] },
            {
                name: 'Value',
                type: FieldType.number,
                values: [1, 2, 3],
                config: {},
            },
        ],
    });
    it('Should take all field values and map to value mappings', function () {
        var options = {
            configRefId: 'config',
            mappings: [
                { fieldName: 'value', handlerKey: 'mappings.value' },
                { fieldName: 'color', handlerKey: 'mappings.color' },
                { fieldName: 'text', handlerKey: 'mappings.text' },
            ],
        };
        var results = extractConfigFromQuery(options, [config, seriesA]);
        expect(results[0].fields[1].config.mappings).toMatchInlineSnapshot("\n      Array [\n        Object {\n          \"options\": Object {\n            \"1\": Object {\n              \"color\": \"red\",\n              \"index\": 0,\n              \"text\": \"one\",\n            },\n            \"2\": Object {\n              \"color\": \"blue\",\n              \"index\": 1,\n              \"text\": \"two\",\n            },\n            \"3\": Object {\n              \"color\": \"green\",\n              \"index\": 2,\n              \"text\": \"three\",\n            },\n          },\n          \"type\": \"value\",\n        },\n      ]\n    ");
    });
});
//# sourceMappingURL=configFromQuery.test.js.map