import { __assign, __awaiter, __generator, __values } from "tslib";
import { ArrayVector, DataTransformerID, FieldMatcherID, fieldMatchers, FieldType, } from '@grafana/data';
import { COUNTRIES_GAZETTEER_PATH, getGazetteer } from 'app/plugins/panel/geomap/gazetteer/gazetteer';
import { mergeMap, from } from 'rxjs';
export var fieldLookupTransformer = {
    id: DataTransformerID.fieldLookup,
    name: 'Lookup fields from resource',
    description: 'Retrieve matching data based on specified field',
    defaultOptions: {},
    operator: function (options) { return function (source) { return source.pipe(mergeMap(function (data) { return from(doGazetteerXform(data, options)); })); }; },
};
function doGazetteerXform(frames, options) {
    var _a;
    return __awaiter(this, void 0, void 0, function () {
        var fieldMatches, gaz;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    fieldMatches = fieldMatchers.get(FieldMatcherID.byName).get(options === null || options === void 0 ? void 0 : options.lookupField);
                    return [4 /*yield*/, getGazetteer((_a = options === null || options === void 0 ? void 0 : options.gazetteer) !== null && _a !== void 0 ? _a : COUNTRIES_GAZETTEER_PATH)];
                case 1:
                    gaz = _b.sent();
                    return [2 /*return*/, addFieldsFromGazetteer(frames, gaz, fieldMatches)];
            }
        });
    });
}
export function addFieldsFromGazetteer(frames, gaz, matcher) {
    return frames.map(function (frame) {
        var e_1, _a;
        var fields = [];
        try {
            for (var _b = __values(frame.fields), _c = _b.next(); !_c.done; _c = _b.next()) {
                var field = _c.value;
                fields.push(field);
                //if the field matches
                if (matcher(field, frame, frames)) {
                    var values = field.values.toArray();
                    var lat = new Array(values.length);
                    var lon = new Array(values.length);
                    //for each value find the corresponding value in the gazetteer
                    for (var v = 0; v < values.length; v++) {
                        var foundMatchingValue = gaz.find(values[v]);
                        //for now start by adding lat and lon
                        if (foundMatchingValue && (foundMatchingValue === null || foundMatchingValue === void 0 ? void 0 : foundMatchingValue.coords.length)) {
                            lon[v] = foundMatchingValue.coords[0];
                            lat[v] = foundMatchingValue.coords[1];
                        }
                    }
                    fields.push({ name: 'lon', type: FieldType.number, values: new ArrayVector(lon), config: {} });
                    fields.push({ name: 'lat', type: FieldType.number, values: new ArrayVector(lat), config: {} });
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_1) throw e_1.error; }
        }
        return __assign(__assign({}, frame), { fields: fields });
    });
}
//# sourceMappingURL=fieldLookup.js.map