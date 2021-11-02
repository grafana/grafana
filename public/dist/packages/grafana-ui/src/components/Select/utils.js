import { __values } from "tslib";
/**
 * Normalize the value format to SelectableValue[] | []. Only used for single select
 */
export var cleanValue = function (value, options) {
    if (Array.isArray(value)) {
        var filtered = value.filter(Boolean);
        return (filtered === null || filtered === void 0 ? void 0 : filtered.length) ? filtered : undefined;
    }
    if (typeof value === 'object') {
        // we want to allow null through into here, so the Select value can be unset
        return [value];
    }
    if (typeof value === 'string' || typeof value === 'number') {
        var selectedValue = findSelectedValue(value, options);
        if (selectedValue) {
            return [selectedValue];
        }
    }
    return undefined;
};
/**
 * Find the label for a string|number value inside array of options or optgroups
 */
export var findSelectedValue = function (value, options) {
    var e_1, _a;
    try {
        for (var options_1 = __values(options), options_1_1 = options_1.next(); !options_1_1.done; options_1_1 = options_1.next()) {
            var option = options_1_1.value;
            if ('options' in option) {
                var found = findSelectedValue(value, option.options);
                if (found) {
                    return found;
                }
            }
            else if ('value' in option && option.value === value) {
                return option;
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (options_1_1 && !options_1_1.done && (_a = options_1.return)) _a.call(options_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return null;
};
//# sourceMappingURL=utils.js.map