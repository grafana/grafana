import { __assign } from "tslib";
import { toDataFrame, ArrayVector, FieldType, toDataFrameDTO, DataFrameType, getFrameDisplayName, } from '@grafana/data';
import { prepareTimeSeriesTransformer, timeSeriesFormat } from './prepareTimeSeries';
describe('Prepare time series transformer', function () {
    it('should transform wide to many', function () {
        var source = [
            toDataFrame({
                name: 'wide',
                refId: 'A',
                fields: [
                    { name: 'time', type: FieldType.time, values: [1, 2, 3, 4, 5, 6] },
                    { name: 'count', type: FieldType.number, values: [10, 20, 30, 40, 50, 60] },
                    { name: 'more', type: FieldType.number, values: [2, 3, 4, 5, 6, 7] },
                ],
            }),
        ];
        var config = {
            format: timeSeriesFormat.TimeSeriesMany,
        };
        expect(prepareTimeSeriesTransformer.transformer(config)(source)).toEqual([
            toEquableDataFrame({
                name: 'wide',
                refId: 'A',
                fields: [
                    { name: 'time', type: FieldType.time, values: [1, 2, 3, 4, 5, 6] },
                    { name: 'count', type: FieldType.number, values: [10, 20, 30, 40, 50, 60] },
                ],
                meta: {
                    type: DataFrameType.TimeSeriesMany,
                },
                length: 6,
            }),
            toEquableDataFrame({
                name: 'wide',
                refId: 'A',
                fields: [
                    { name: 'time', type: FieldType.time, values: [1, 2, 3, 4, 5, 6] },
                    { name: 'more', type: FieldType.number, values: [2, 3, 4, 5, 6, 7] },
                ],
                meta: {
                    type: DataFrameType.TimeSeriesMany,
                },
                length: 6,
            }),
        ]);
    });
    it('should treat string fields as labels', function () {
        var source = [
            toDataFrame({
                name: 'wide',
                refId: 'A',
                fields: [
                    { name: 'time', type: FieldType.time, values: [1, 1, 2, 2] },
                    { name: 'region', type: FieldType.string, values: ['a', 'b', 'a', 'b'] },
                    { name: 'count', type: FieldType.number, values: [10, 20, 30, 40] },
                    { name: 'more', type: FieldType.number, values: [2, 3, 4, 5] },
                ],
            }),
        ];
        var config = {
            format: timeSeriesFormat.TimeSeriesMany,
        };
        var frames = prepareTimeSeriesTransformer.transformer(config)(source);
        expect(frames.length).toEqual(4);
        expect(frames.map(function (f) { return ({
            name: getFrameDisplayName(f),
            labels: f.fields[1].labels,
            time: f.fields[0].values.toArray(),
            values: f.fields[1].values.toArray(),
        }); })).toMatchInlineSnapshot("\n      Array [\n        Object {\n          \"labels\": Object {\n            \"region\": \"a\",\n          },\n          \"name\": \"wide\",\n          \"time\": Array [\n            1,\n            2,\n          ],\n          \"values\": Array [\n            10,\n            30,\n          ],\n        },\n        Object {\n          \"labels\": Object {\n            \"region\": \"b\",\n          },\n          \"name\": \"wide\",\n          \"time\": Array [\n            1,\n            2,\n          ],\n          \"values\": Array [\n            20,\n            40,\n          ],\n        },\n        Object {\n          \"labels\": Object {\n            \"region\": \"a\",\n          },\n          \"name\": \"wide\",\n          \"time\": Array [\n            1,\n            2,\n          ],\n          \"values\": Array [\n            2,\n            4,\n          ],\n        },\n        Object {\n          \"labels\": Object {\n            \"region\": \"b\",\n          },\n          \"name\": \"wide\",\n          \"time\": Array [\n            1,\n            2,\n          ],\n          \"values\": Array [\n            3,\n            5,\n          ],\n        },\n      ]\n    ");
    });
    it('should transform all wide to many when mixed', function () {
        var source = [
            toDataFrame({
                name: 'wide',
                refId: 'A',
                fields: [
                    { name: 'time', type: FieldType.time, values: [0, 1, 2, 3, 4, 5] },
                    { name: 'count', type: FieldType.number, values: [10, 20, 30, 40, 50, 60] },
                    { name: 'another', type: FieldType.number, values: [2, 3, 4, 5, 6, 7] },
                ],
            }),
            toDataFrame({
                name: 'long',
                refId: 'B',
                fields: [
                    { name: 'time', type: FieldType.time, values: [4, 5, 6, 7, 8, 9] },
                    { name: 'value', type: FieldType.number, values: [2, 3, 4, 5, 6, 7] },
                ],
            }),
        ];
        var config = {
            format: timeSeriesFormat.TimeSeriesMany,
        };
        expect(prepareTimeSeriesTransformer.transformer(config)(source)).toEqual([
            toEquableDataFrame({
                name: 'wide',
                refId: 'A',
                fields: [
                    { name: 'time', type: FieldType.time, values: [0, 1, 2, 3, 4, 5] },
                    { name: 'another', type: FieldType.number, values: [2, 3, 4, 5, 6, 7] },
                ],
                length: 6,
                meta: {
                    type: DataFrameType.TimeSeriesMany,
                },
            }),
            toEquableDataFrame({
                name: 'wide',
                refId: 'A',
                fields: [
                    { name: 'time', type: FieldType.time, values: [0, 1, 2, 3, 4, 5] },
                    { name: 'count', type: FieldType.number, values: [10, 20, 30, 40, 50, 60] },
                ],
                length: 6,
                meta: {
                    type: DataFrameType.TimeSeriesMany,
                },
            }),
            toEquableDataFrame({
                name: 'long',
                refId: 'B',
                fields: [
                    { name: 'time', type: FieldType.time, values: [4, 5, 6, 7, 8, 9] },
                    { name: 'value', type: FieldType.number, values: [2, 3, 4, 5, 6, 7] },
                ],
                length: 6,
                meta: {
                    type: DataFrameType.TimeSeriesMany,
                },
            }),
        ]);
    });
    it('should transform none when source only has long frames', function () {
        var source = [
            toDataFrame({
                name: 'long',
                refId: 'A',
                fields: [
                    { name: 'time', type: FieldType.time, values: [1, 2, 3, 4, 5, 6] },
                    { name: 'count', type: FieldType.number, values: [10, 20, 30, 40, 50, 60] },
                ],
            }),
            toDataFrame({
                name: 'long',
                refId: 'B',
                fields: [
                    { name: 'time', type: FieldType.time, values: [1, 2, 3, 4, 5, 6] },
                    { name: 'count', type: FieldType.number, values: [10, 20, 30, 40, 50, 60] },
                ],
            }),
        ];
        var config = {
            format: timeSeriesFormat.TimeSeriesMany,
        };
        expect(toEquableDataFrames(prepareTimeSeriesTransformer.transformer(config)(source))).toEqual(toEquableDataFrames(source.map(function (frame) { return (__assign(__assign({}, frame), { meta: {
                type: DataFrameType.TimeSeriesMany,
            } })); })));
    });
    it('should return empty array when no timeseries exist', function () {
        var source = [
            toDataFrame({
                name: 'wide',
                refId: 'A',
                fields: [
                    { name: 'text', type: FieldType.string, values: ['a', 'z', 'b', 'x', 'c', 'b'] },
                    { name: 'text', type: FieldType.string, values: ['a', 'z', 'b', 'x', 'c', 'b'] },
                    { name: 'text', type: FieldType.string, values: ['a', 'z', 'b', 'x', 'c', 'b'] },
                ],
            }),
            toDataFrame({
                name: 'wide',
                refId: 'B',
                fields: [
                    { name: 'text', type: FieldType.string, values: ['a', 'z', 'b', 'x', 'c', 'b'] },
                    { name: 'text', type: FieldType.string, values: ['a', 'z', 'b', 'x', 'c', 'b'] },
                    { name: 'text', type: FieldType.string, values: ['a', 'z', 'b', 'x', 'c', 'b'] },
                ],
            }),
        ];
        var config = {
            format: timeSeriesFormat.TimeSeriesMany,
        };
        expect(prepareTimeSeriesTransformer.transformer(config)(source)).toEqual([]);
    });
    it('should convert long to many', function () {
        var source = [
            toDataFrame({
                name: 'long',
                refId: 'X',
                fields: [
                    { name: 'time', type: FieldType.time, values: [1, 1, 2, 2, 3, 3] },
                    { name: 'value', type: FieldType.number, values: [10, 20, 30, 40, 50, 60] },
                    { name: 'region', type: FieldType.string, values: ['a', 'b', 'a', 'b', 'a', 'b'] },
                ],
            }),
        ];
        var config = {
            format: timeSeriesFormat.TimeSeriesMany,
        };
        var frames = prepareTimeSeriesTransformer.transformer(config)(source);
        expect(frames).toEqual([
            toEquableDataFrame({
                name: 'long',
                refId: 'X',
                fields: [
                    { name: 'time', type: FieldType.time, values: [1, 2, 3] },
                    { name: 'value', labels: { region: 'a' }, type: FieldType.number, values: [10, 30, 50] },
                ],
                length: 3,
                meta: {
                    type: DataFrameType.TimeSeriesMany,
                },
            }),
            toEquableDataFrame({
                name: 'long',
                refId: 'X',
                fields: [
                    { name: 'time', type: FieldType.time, values: [1, 2, 3] },
                    { name: 'value', labels: { region: 'b' }, type: FieldType.number, values: [20, 40, 60] },
                ],
                length: 3,
                meta: {
                    type: DataFrameType.TimeSeriesMany,
                },
            }),
        ]);
    });
});
function toEquableDataFrame(source) {
    return toDataFrame(__assign(__assign({ meta: undefined }, source), { fields: source.fields.map(function (field) {
            return __assign(__assign({}, field), { values: new ArrayVector(field.values), config: {} });
        }) }));
}
function toEquableDataFrames(data) {
    return data.map(function (frame) { return toDataFrameDTO(frame); });
}
//# sourceMappingURL=prepareTimeSeries.test.js.map