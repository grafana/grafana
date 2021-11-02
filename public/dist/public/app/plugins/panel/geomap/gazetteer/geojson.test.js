import { __assign, __awaiter, __generator } from "tslib";
import { getGazetteer } from './gazetteer';
var backendResults = { hello: 'world' };
var geojsonObject = {
    type: 'FeatureCollection',
    features: [
        {
            id: 'A',
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [0, 0],
            },
            properties: {
                hello: 'A',
            },
        },
        {
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [1, 1],
            },
            properties: {
                some_code: 'B',
                hello: 'B',
            },
        },
        {
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [2, 2],
            },
            properties: {
                an_id: 'C',
                hello: 'C',
            },
        },
    ],
};
jest.mock('@grafana/runtime', function () { return (__assign(__assign({}, jest.requireActual('@grafana/runtime')), { getBackendSrv: function () { return ({
        get: jest.fn().mockResolvedValue(backendResults),
    }); } })); });
describe('Placename lookup from geojson format', function () {
    beforeEach(function () {
        backendResults = { hello: 'world' };
    });
    it('can lookup by id', function () { return __awaiter(void 0, void 0, void 0, function () {
        var gaz;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    backendResults = geojsonObject;
                    return [4 /*yield*/, getGazetteer('local')];
                case 1:
                    gaz = _a.sent();
                    expect(gaz.error).toBeUndefined();
                    expect(gaz.find('A')).toMatchInlineSnapshot("\n      Object {\n        \"coords\": Array [\n          0,\n          0,\n        ],\n      }\n    ");
                    return [2 /*return*/];
            }
        });
    }); });
    it('can look up by a code', function () { return __awaiter(void 0, void 0, void 0, function () {
        var gaz;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    backendResults = geojsonObject;
                    return [4 /*yield*/, getGazetteer('airports')];
                case 1:
                    gaz = _a.sent();
                    expect(gaz.error).toBeUndefined();
                    expect(gaz.find('B')).toMatchInlineSnapshot("\n      Object {\n        \"coords\": Array [\n          1,\n          1,\n        ],\n      }\n    ");
                    return [2 /*return*/];
            }
        });
    }); });
    it('can look up by an id property', function () { return __awaiter(void 0, void 0, void 0, function () {
        var gaz;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    backendResults = geojsonObject;
                    return [4 /*yield*/, getGazetteer('airports')];
                case 1:
                    gaz = _a.sent();
                    expect(gaz.error).toBeUndefined();
                    expect(gaz.find('C')).toMatchInlineSnapshot("\n      Object {\n        \"coords\": Array [\n          2,\n          2,\n        ],\n      }\n    ");
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=geojson.test.js.map