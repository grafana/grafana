import { __awaiter, __generator } from "tslib";
import { getBackendSrv } from '@grafana/runtime';
import { loadWorldmapPoints } from './worldmap';
import { loadFromGeoJSON } from './geojson';
// Without knowing the datatype pick a good lookup function
export function loadGazetteer(path, data) {
    // Check for legacy worldmap syntax
    if (Array.isArray(data)) {
        var first = data[0];
        if (first.latitude && first.longitude && (first.key || first.keys)) {
            return loadWorldmapPoints(path, data);
        }
    }
    // try loading geojson
    var features = data === null || data === void 0 ? void 0 : data.features;
    if (Array.isArray(features) && (data === null || data === void 0 ? void 0 : data.type) === 'FeatureCollection') {
        return loadFromGeoJSON(path, data);
    }
    return {
        path: path,
        error: 'Unable to parse locations',
        find: function (k) { return undefined; },
        examples: function (v) { return []; },
    };
}
var registry = {};
export var COUNTRIES_GAZETTEER_PATH = 'public/gazetteer/countries.json';
/**
 * Given a path to a file return a cached lookup function
 */
export function getGazetteer(path) {
    return __awaiter(this, void 0, void 0, function () {
        var lookup, data, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    // When not specified, use the default path
                    if (!path) {
                        path = COUNTRIES_GAZETTEER_PATH;
                    }
                    lookup = registry[path];
                    if (!!lookup) return [3 /*break*/, 5];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, getBackendSrv().get(path)];
                case 2:
                    data = _a.sent();
                    lookup = loadGazetteer(path, data);
                    return [3 /*break*/, 4];
                case 3:
                    err_1 = _a.sent();
                    console.warn('Error loading placename lookup', path, err_1);
                    lookup = {
                        path: path,
                        error: 'Error loading URL',
                        find: function (k) { return undefined; },
                        examples: function (v) { return []; },
                    };
                    return [3 /*break*/, 4];
                case 4:
                    registry[path] = lookup;
                    _a.label = 5;
                case 5: return [2 /*return*/, lookup];
            }
        });
    });
}
//# sourceMappingURL=gazetteer.js.map