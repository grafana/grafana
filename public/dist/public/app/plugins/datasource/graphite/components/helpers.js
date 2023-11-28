import { forEach, sortBy } from 'lodash';
import { GraphiteQueryType } from '../types';
export function mapStringsToSelectables(values) {
    return values.map((value) => ({
        value,
        label: value,
    }));
}
export function mapSegmentsToSelectables(segments) {
    return segments.map((segment) => ({
        label: segment.value,
        value: segment,
    }));
}
export function mapFuncDefsToSelectables(funcDefs) {
    const categories = {};
    forEach(funcDefs, (funcDef) => {
        if (!funcDef.category) {
            return;
        }
        if (!categories[funcDef.category]) {
            categories[funcDef.category] = { label: funcDef.category, value: funcDef.category, options: [] };
        }
        categories[funcDef.category].options.push({
            label: funcDef.name,
            value: funcDef.name,
        });
    });
    return sortBy(categories, 'label');
}
function createEditableParam(paramDef, additional, value) {
    var _a, _b;
    return {
        name: paramDef.name,
        value: (value === null || value === void 0 ? void 0 : value.toString()) || '',
        optional: !!paramDef.optional || additional,
        multiple: !!paramDef.multiple,
        options: (_b = (_a = paramDef.options) === null || _a === void 0 ? void 0 : _a.map((option) => ({
            value: option.toString(),
            label: option.toString(),
        }))) !== null && _b !== void 0 ? _b : [],
    };
}
/**
 * Create a list of params that can be edited in the function editor.
 */
export function mapFuncInstanceToParams(func) {
    var _a;
    // list of required parameters (from func.def)
    const params = func.def.params.map((paramDef, index) => createEditableParam(paramDef, false, func.params[index]));
    // list of additional (multiple or optional) params entered by the user
    while (params.length < func.params.length) {
        const paramDef = func.def.params[func.def.params.length - 1];
        const value = func.params[params.length];
        params.push(createEditableParam(paramDef, true, value));
    }
    // extra "fake" param to allow adding more multiple values at the end
    if (params.length && params[params.length - 1].value && ((_a = params[params.length - 1]) === null || _a === void 0 ? void 0 : _a.multiple)) {
        const paramDef = func.def.params[func.def.params.length - 1];
        params.push(createEditableParam(paramDef, true, ''));
    }
    return params;
}
export function convertToGraphiteQueryObject(query) {
    if (typeof query === 'string') {
        return {
            refId: 'A',
            target: query,
            queryType: GraphiteQueryType.Default.toString(),
        };
    }
    return query;
}
//# sourceMappingURL=helpers.js.map