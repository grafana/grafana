import { __assign, __awaiter, __generator } from "tslib";
import InfluxQueryModel from '../../influx_query_model';
import { unwrap } from './unwrap';
import queryPart from '../../query_part';
import { toSelectableValue } from './toSelectableValue';
export function getNewSelectPartOptions() {
    var categories = queryPart.getCategories();
    var options = [];
    var keys = Object.keys(categories);
    keys.forEach(function (key) {
        var children = categories[key].map(function (x) { return toSelectableValue(x.type); });
        options.push({
            label: key,
            options: children,
        });
    });
    return options;
}
export function getNewGroupByPartOptions(query, getTagKeys) {
    return __awaiter(this, void 0, void 0, function () {
        var tagKeys, queryCopy, model, options;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getTagKeys()];
                case 1:
                    tagKeys = _a.sent();
                    queryCopy = __assign({}, query);
                    model = new InfluxQueryModel(queryCopy);
                    options = [];
                    if (!model.hasFill()) {
                        options.push(toSelectableValue('fill(null)'));
                    }
                    if (!model.hasGroupByTime()) {
                        options.push(toSelectableValue('time($interval)'));
                    }
                    tagKeys.forEach(function (key) {
                        options.push(toSelectableValue("tag(" + key + ")"));
                    });
                    return [2 /*return*/, options];
            }
        });
    });
}
function getPartParams(part, dynamicParamOptions) {
    var _a;
    // NOTE: the way the system is constructed,
    // there always can only be one possible dynamic-lookup
    // field. in case of select it is the field,
    // in case of group-by it is the tag
    var def = queryPart.create(part).def;
    // we switch the numbers to strings, it will work that way too,
    // and it makes the code simpler
    var paramValues = ((_a = part.params) !== null && _a !== void 0 ? _a : []).map(function (p) { return p.toString(); });
    if (paramValues.length !== def.params.length) {
        throw new Error('Invalid query-segment');
    }
    return paramValues.map(function (val, index) {
        var defParam = def.params[index];
        if (defParam.dynamicLookup) {
            return {
                value: val,
                options: unwrap(dynamicParamOptions.get(def.type + "_" + index)),
            };
        }
        if (defParam.options != null) {
            return {
                value: val,
                options: function () { return Promise.resolve(defParam.options); },
            };
        }
        return {
            value: val,
            options: null,
        };
    });
}
export function makePartList(queryParts, dynamicParamOptions) {
    return queryParts.map(function (qp) {
        return {
            name: qp.type,
            params: getPartParams(qp, dynamicParamOptions),
        };
    });
}
//# sourceMappingURL=partListUtils.js.map