import { __awaiter, __generator } from "tslib";
import { FieldMatcherID, fieldMatchers, FieldType } from '@grafana/data';
import { toDataFrame } from '@grafana/data/src/dataframe/processDataFrame';
import { DataTransformerID } from '@grafana/data/src/transformations/transformers/ids';
import { addFieldsFromGazetteer } from './fieldLookup';
describe('Lookup gazetteer', function () {
    it('adds lat/lon based on string field', function () { return __awaiter(void 0, void 0, void 0, function () {
        var cfg, data, matcher, values, gaz, _a;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    cfg = {
                        id: DataTransformerID.fieldLookup,
                        options: {
                            lookupField: 'location',
                            gazetteer: 'public/gazetteer/usa-states.json',
                        },
                    };
                    data = toDataFrame({
                        name: 'locations',
                        fields: [
                            { name: 'location', type: FieldType.string, values: ['AL', 'AK', 'Arizona', 'Arkansas', 'Somewhere'] },
                            { name: 'values', type: FieldType.number, values: [0, 10, 5, 1, 5] },
                        ],
                    });
                    matcher = fieldMatchers.get(FieldMatcherID.byName).get((_b = cfg.options) === null || _b === void 0 ? void 0 : _b.lookupField);
                    values = new Map()
                        .set('AL', { name: 'Alabama', id: 'AL', coords: [-80.891064, 12.448457] })
                        .set('AK', { name: 'Arkansas', id: 'AK', coords: [-100.891064, 24.448457] })
                        .set('AZ', { name: 'Arizona', id: 'AZ', coords: [-111.891064, 33.448457] })
                        .set('Arizona', { name: 'Arizona', id: 'AZ', coords: [-111.891064, 33.448457] });
                    gaz = {
                        count: 3,
                        examples: function () { return ['AL', 'AK', 'AZ']; },
                        find: function (k) {
                            var v = values.get(k);
                            if (!v && typeof k === 'string') {
                                v = values.get(k.toUpperCase());
                            }
                            return v;
                        },
                        path: 'public/gazetteer/usa-states.json',
                    };
                    _a = expect;
                    return [4 /*yield*/, addFieldsFromGazetteer([data], gaz, matcher)];
                case 1:
                    _a.apply(void 0, [_c.sent()]).toMatchInlineSnapshot("\n      Array [\n        Object {\n          \"creator\": [Function],\n          \"fields\": Array [\n            Object {\n              \"config\": Object {},\n              \"name\": \"location\",\n              \"type\": \"string\",\n              \"values\": Array [\n                \"AL\",\n                \"AK\",\n                \"Arizona\",\n                \"Arkansas\",\n                \"Somewhere\",\n              ],\n            },\n            Object {\n              \"config\": Object {},\n              \"name\": \"lon\",\n              \"type\": \"number\",\n              \"values\": Array [\n                -80.891064,\n                -100.891064,\n                -111.891064,\n                undefined,\n                undefined,\n              ],\n            },\n            Object {\n              \"config\": Object {},\n              \"name\": \"lat\",\n              \"type\": \"number\",\n              \"values\": Array [\n                12.448457,\n                24.448457,\n                33.448457,\n                undefined,\n                undefined,\n              ],\n            },\n            Object {\n              \"config\": Object {},\n              \"name\": \"values\",\n              \"state\": Object {\n                \"displayName\": \"values\",\n              },\n              \"type\": \"number\",\n              \"values\": Array [\n                0,\n                10,\n                5,\n                1,\n                5,\n              ],\n            },\n          ],\n          \"first\": Array [\n            \"AL\",\n            \"AK\",\n            \"Arizona\",\n            \"Arkansas\",\n            \"Somewhere\",\n          ],\n          \"length\": 5,\n          \"name\": \"locations\",\n        },\n      ]\n    ");
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=fieldLookup.test.js.map