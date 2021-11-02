import { __values } from "tslib";
import GeoJSON from 'ol/format/GeoJSON';
export function loadFromGeoJSON(path, body) {
    var e_1, _a, e_2, _b;
    var data = new GeoJSON().readFeatures(body);
    var count = 0;
    var values = new Map();
    try {
        for (var data_1 = __values(data), data_1_1 = data_1.next(); !data_1_1.done; data_1_1 = data_1.next()) {
            var f = data_1_1.value;
            var coords = f.getGeometry().getFlatCoordinates(); //for now point, eventually geometry
            var info = {
                coords: coords,
            };
            var id = f.getId();
            if (id) {
                if (typeof id === 'number') {
                    values.set(id.toString(), info);
                }
                else {
                    values.set(id, info);
                    values.set(id.toUpperCase(), info);
                }
            }
            var properties = f.getProperties();
            if (properties) {
                try {
                    for (var _c = (e_2 = void 0, __values(Object.keys(properties))), _d = _c.next(); !_d.done; _d = _c.next()) {
                        var k = _d.value;
                        if (k.includes('_code') || k.includes('_id')) {
                            var value = properties[k];
                            if (value) {
                                if (typeof value === 'number') {
                                    values.set(value.toString(), info);
                                }
                                else {
                                    values.set(value, info);
                                    values.set(value.toUpperCase(), info);
                                }
                            }
                        }
                    }
                }
                catch (e_2_1) { e_2 = { error: e_2_1 }; }
                finally {
                    try {
                        if (_d && !_d.done && (_b = _c.return)) _b.call(_c);
                    }
                    finally { if (e_2) throw e_2.error; }
                }
            }
            count++;
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (data_1_1 && !data_1_1.done && (_a = data_1.return)) _a.call(data_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return {
        path: path,
        find: function (k) {
            var v = values.get(k);
            if (!v && typeof k === 'string') {
                v = values.get(k.toUpperCase());
            }
            return v;
        },
        count: count,
        examples: function (count) {
            var e_3, _a;
            var first = [];
            if (values.size < 1) {
                first.push('no values found');
            }
            else {
                try {
                    for (var _b = __values(values.keys()), _c = _b.next(); !_c.done; _c = _b.next()) {
                        var key = _c.value;
                        first.push(key);
                        if (first.length >= count) {
                            break;
                        }
                    }
                }
                catch (e_3_1) { e_3 = { error: e_3_1 }; }
                finally {
                    try {
                        if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                    }
                    finally { if (e_3) throw e_3.error; }
                }
            }
            return first;
        },
    };
}
//# sourceMappingURL=geojson.js.map