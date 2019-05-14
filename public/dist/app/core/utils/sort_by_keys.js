import * as tslib_1 from "tslib";
import _ from 'lodash';
export default function sortByKeys(input) {
    var e_1, _a;
    if (_.isArray(input)) {
        return input.map(sortByKeys);
    }
    if (_.isPlainObject(input)) {
        var sortedObject = {};
        try {
            for (var _b = tslib_1.__values(_.keys(input).sort()), _c = _b.next(); !_c.done; _c = _b.next()) {
                var key = _c.value;
                sortedObject[key] = sortByKeys(input[key]);
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_1) throw e_1.error; }
        }
        return sortedObject;
    }
    return input;
}
//# sourceMappingURL=sort_by_keys.js.map