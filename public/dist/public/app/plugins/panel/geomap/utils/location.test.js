import { __awaiter, __generator } from "tslib";
import { toDataFrame, FieldType, FrameGeometrySourceMode } from '@grafana/data';
import { toLonLat } from 'ol/proj';
import { dataFrameToPoints, getLocationFields, getLocationMatchers } from './location';
var longitude = [0, -74.1];
var latitude = [0, 40.7];
var geohash = ['9q94r', 'dr5rs'];
var names = ['A', 'B'];
describe('handle location parsing', function () {
    it('auto should find geohash field', function () { return __awaiter(void 0, void 0, void 0, function () {
        var frame, matchers, fields, info;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    frame = toDataFrame({
                        name: 'simple',
                        fields: [
                            { name: 'name', type: FieldType.string, values: names },
                            { name: 'geohash', type: FieldType.number, values: geohash },
                        ],
                    });
                    return [4 /*yield*/, getLocationMatchers()];
                case 1:
                    matchers = _b.sent();
                    fields = getLocationFields(frame, matchers);
                    expect(fields.mode).toEqual(FrameGeometrySourceMode.Geohash);
                    expect(fields.geohash).toBeDefined();
                    expect((_a = fields.geohash) === null || _a === void 0 ? void 0 : _a.name).toEqual('geohash');
                    info = dataFrameToPoints(frame, matchers);
                    expect(info.points.map(function (p) { return toLonLat(p.getCoordinates()); })).toMatchInlineSnapshot("\n        Array [\n          Array [\n            -122.01416015625001,\n            36.979980468750014,\n          ],\n          Array [\n            -73.98193359375,\n            40.71533203125,\n          ],\n        ]\n      ");
                    return [2 /*return*/];
            }
        });
    }); });
    it('auto should find coordinate fields', function () { return __awaiter(void 0, void 0, void 0, function () {
        var frame, matchers, info;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    frame = toDataFrame({
                        name: 'simple',
                        fields: [
                            { name: 'name', type: FieldType.string, values: names },
                            { name: 'latitude', type: FieldType.number, values: latitude },
                            { name: 'longitude', type: FieldType.number, values: longitude },
                        ],
                    });
                    return [4 /*yield*/, getLocationMatchers()];
                case 1:
                    matchers = _a.sent();
                    info = dataFrameToPoints(frame, matchers);
                    expect(info.points.map(function (p) { return toLonLat(p.getCoordinates()); })).toMatchInlineSnapshot("\n      Array [\n        Array [\n          0,\n          0,\n        ],\n        Array [\n          -74.1,\n          40.69999999999999,\n        ],\n      ]\n    ");
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=location.test.js.map