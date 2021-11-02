import { forEach, sortBy } from 'lodash';
export function mapStringsToSelectables(values) {
    return values.map(function (value) { return ({
        value: value,
        label: value,
    }); });
}
export function mapSegmentsToSelectables(segments) {
    return segments.map(function (segment) { return ({
        label: segment.value,
        value: segment,
    }); });
}
export function mapFuncDefsToSelectables(funcDefs) {
    var categories = {};
    forEach(funcDefs, function (funcDef) {
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
        options: (_b = (_a = paramDef.options) === null || _a === void 0 ? void 0 : _a.map(function (option) { return ({
            value: option.toString(),
            label: option.toString(),
        }); })) !== null && _b !== void 0 ? _b : [],
    };
}
/**
 * Create a list of params that can be edited in the function editor.
 */
export function mapFuncInstanceToParams(func) {
    var _a;
    // list of required parameters (from func.def)
    var params = func.def.params.map(function (paramDef, index) {
        return createEditableParam(paramDef, false, func.params[index]);
    });
    // list of additional (multiple or optional) params entered by the user
    while (params.length < func.params.length) {
        var paramDef = func.def.params[func.def.params.length - 1];
        var value = func.params[params.length];
        params.push(createEditableParam(paramDef, true, value));
    }
    // extra "fake" param to allow adding more multiple values at the end
    if (params.length && params[params.length - 1].value && ((_a = params[params.length - 1]) === null || _a === void 0 ? void 0 : _a.multiple)) {
        var paramDef = func.def.params[func.def.params.length - 1];
        params.push(createEditableParam(paramDef, true, ''));
    }
    return params;
}
//# sourceMappingURL=helpers.js.map