import { __values } from "tslib";
export function loadWorldmapPoints(path, data) {
    var e_1, _a, e_2, _b;
    var count = 0;
    var values = new Map();
    try {
        for (var data_1 = __values(data), data_1_1 = data_1.next(); !data_1_1.done; data_1_1 = data_1.next()) {
            var v = data_1_1.value;
            var info = {
                coords: [v.longitude, v.latitude],
            };
            if (v.name) {
                values.set(v.name, info);
                values.set(v.name.toUpperCase(), info);
                info.props = { name: v.name };
            }
            if (v.key) {
                values.set(v.key, info);
                values.set(v.key.toUpperCase(), info);
            }
            if (v.keys) {
                try {
                    for (var _c = (e_2 = void 0, __values(v.keys)), _d = _c.next(); !_d.done; _d = _c.next()) {
                        var key = _d.value;
                        values.set(key, info);
                        values.set(key.toUpperCase(), info);
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
//# sourceMappingURL=worldmap.js.map