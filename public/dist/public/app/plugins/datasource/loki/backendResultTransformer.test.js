import { cloneDeep } from 'lodash';
import { FieldType } from '@grafana/data';
import { transformBackendResult } from './backendResultTransformer';
// needed because the derived-fields functionality calls it
jest.mock('@grafana/runtime', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { getDataSourceSrv: () => {
        return {
            getInstanceSettings: () => {
                return { name: 'Loki1' };
            },
        };
    } })));
const LOKI_EXPR = '{level="info"} |= "thing1"';
const inputFrame = {
    refId: 'A',
    meta: {
        executedQueryString: LOKI_EXPR,
        custom: {
            frameType: 'LabeledTimeValues',
        },
    },
    fields: [
        {
            name: 'Time',
            type: FieldType.time,
            config: {},
            values: [1645030244810, 1645030247027],
        },
        {
            name: 'Line',
            type: FieldType.string,
            config: {},
            values: ['line1', 'line2'],
        },
        {
            name: 'labels',
            type: FieldType.other,
            config: {},
            values: [
                { level: 'info', code: '41🌙' },
                { level: 'error', code: '41🌙' },
            ],
        },
        {
            name: 'tsNs',
            type: FieldType.string,
            config: {},
            values: ['1645030244810757120', '1645030247027735040'],
        },
        {
            name: 'id',
            type: FieldType.string,
            config: {},
            values: ['id1', 'id2'],
        },
    ],
    length: 5,
};
describe('loki backendResultTransformer', () => {
    it('processes a logs-dataframe correctly', () => {
        var _a;
        const response = { data: [cloneDeep(inputFrame)] };
        const expectedFrame = cloneDeep(inputFrame);
        expectedFrame.meta = Object.assign(Object.assign({}, expectedFrame.meta), { preferredVisualisationType: 'logs', searchWords: ['thing1'], custom: Object.assign(Object.assign({}, (_a = expectedFrame.meta) === null || _a === void 0 ? void 0 : _a.custom), { lokiQueryStatKey: 'Summary: total bytes processed' }) });
        const expected = { data: [expectedFrame] };
        const result = transformBackendResult(response, [
            {
                refId: 'A',
                expr: LOKI_EXPR,
            },
        ], []);
        expect(result).toEqual(expected);
    });
    it('applies maxLines correctly', () => {
        var _a, _b;
        const response = { data: [cloneDeep(inputFrame)] };
        const frame1 = transformBackendResult(response, [
            {
                refId: 'A',
                expr: LOKI_EXPR,
            },
        ], []).data[0];
        expect((_a = frame1.meta) === null || _a === void 0 ? void 0 : _a.limit).toBeUndefined();
        const frame2 = transformBackendResult(response, [
            {
                refId: 'A',
                expr: LOKI_EXPR,
                maxLines: 42,
            },
        ], []).data[0];
        expect((_b = frame2.meta) === null || _b === void 0 ? void 0 : _b.limit).toBe(42);
    });
    it('processed derived fields correctly', () => {
        const input = {
            length: 1,
            fields: [
                {
                    name: 'time',
                    config: {},
                    values: [1],
                    type: FieldType.time,
                },
                {
                    name: 'line',
                    config: {},
                    values: ['line1'],
                    type: FieldType.string,
                },
            ],
        };
        const response = { data: [input] };
        const result = transformBackendResult(response, [{ refId: 'A', expr: '' }], [
            {
                matcherRegex: 'trace=(w+)',
                name: 'derived1',
                url: 'example.com',
            },
        ]);
        expect(result.data[0].fields.filter((field) => field.name === 'derived1' && field.type === 'string').length).toBe(1);
    });
    it('handle loki parsing errors', () => {
        var _a, _b, _c;
        const clonedFrame = cloneDeep(inputFrame);
        clonedFrame.fields[2] = {
            name: 'labels',
            type: FieldType.string,
            config: {},
            values: [
                { level: 'info', code: '41🌙', __error__: 'LogfmtParserErr' },
                { level: 'error', code: '41🌙' },
            ],
        };
        const response = { data: [clonedFrame] };
        const result = transformBackendResult(response, [
            {
                refId: 'A',
                expr: LOKI_EXPR,
            },
        ], []);
        expect((_c = (_b = (_a = result.data[0]) === null || _a === void 0 ? void 0 : _a.meta) === null || _b === void 0 ? void 0 : _b.custom) === null || _c === void 0 ? void 0 : _c.error).toBe('Error when parsing some of the logs');
    });
    it('improve loki escaping error message when query contains escape', () => {
        var _a;
        const response = {
            data: [],
            error: {
                refId: 'A',
                message: 'parse error at line 1, col 2: invalid char escape',
            },
        };
        const result = transformBackendResult(response, [
            {
                refId: 'A',
                expr: '{place="g\\arden"}',
            },
        ], []);
        expect((_a = result.error) === null || _a === void 0 ? void 0 : _a.message).toBe(`parse error at line 1, col 2: invalid char escape. Make sure that all special characters are escaped with \\. For more information on escaping of special characters visit LogQL documentation at https://grafana.com/docs/loki/latest/logql/.`);
    });
    it('do not change loki escaping error message when query does not contain escape', () => {
        var _a;
        const response = {
            data: [],
            error: {
                refId: 'A',
                message: 'parse error at line 1, col 2: invalid char escape',
            },
        };
        const result = transformBackendResult(response, [
            {
                refId: 'A',
                expr: '{place="garden"}',
            },
        ], []);
        expect((_a = result.error) === null || _a === void 0 ? void 0 : _a.message).toBe('parse error at line 1, col 2: invalid char escape');
    });
});
//# sourceMappingURL=backendResultTransformer.test.js.map