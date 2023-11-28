import { __awaiter } from "tslib";
import InfluxQueryModel from '../../../../../influx_query_model';
import queryPart from '../../../../../query_part';
import { toSelectableValue } from './toSelectableValue';
import { unwrap } from './unwrap';
export function getNewSelectPartOptions() {
    const categories = queryPart.getCategories();
    const options = [];
    const keys = Object.keys(categories);
    keys.forEach((key) => {
        const children = categories[key].map((x) => toSelectableValue(x.type));
        options.push({
            label: key,
            options: children,
        });
    });
    return options;
}
export function getNewGroupByPartOptions(query, getTagKeys) {
    return __awaiter(this, void 0, void 0, function* () {
        const tagKeys = yield getTagKeys();
        const queryCopy = Object.assign({}, query); // the query-model mutates the query
        const model = new InfluxQueryModel(queryCopy);
        const options = [];
        if (!model.hasFill()) {
            options.push(toSelectableValue('fill(null)'));
        }
        if (!model.hasGroupByTime()) {
            options.push(toSelectableValue('time($interval)'));
        }
        tagKeys.forEach((key) => {
            options.push(toSelectableValue(`tag(${key})`));
        });
        return options;
    });
}
function getPartParams(part, dynamicParamOptions) {
    var _a;
    // NOTE: the way the system is constructed,
    // there always can only be one possible dynamic-lookup
    // field. in case of select it is the field,
    // in case of group-by it is the tag
    const def = queryPart.create(part).def;
    // we switch the numbers to strings, it will work that way too,
    // and it makes the code simpler
    const paramValues = ((_a = part.params) !== null && _a !== void 0 ? _a : []).map((p) => p.toString());
    if (paramValues.length !== def.params.length) {
        throw new Error('Invalid query-segment');
    }
    return paramValues.map((val, index) => {
        const defParam = def.params[index];
        if (defParam.dynamicLookup) {
            return {
                value: val,
                options: unwrap(dynamicParamOptions.get(`${def.type}_${index}`)),
            };
        }
        if (defParam.options != null) {
            return {
                value: val,
                options: () => Promise.resolve(defParam.options),
            };
        }
        return {
            value: val,
            options: null,
        };
    });
}
export function makePartList(queryParts, dynamicParamOptions) {
    return queryParts.map((qp) => {
        return {
            name: qp.type,
            params: getPartParams(qp, dynamicParamOptions),
        };
    });
}
//# sourceMappingURL=partListUtils.js.map