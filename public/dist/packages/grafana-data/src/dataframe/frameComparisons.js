import { __values } from "tslib";
/**
 * Returns true if both frames have the same name, fields, labels and configs.
 *
 * @example
 * To compare multiple frames use:
 * ```
 * compareArrayValues(a, b, framesHaveSameStructure);
 * ```
 * NOTE: this does a shallow check on the FieldConfig properties, when using the query
 * editor, this should be sufficient, however if applications are mutating properties
 * deep in the FieldConfig this will not recognize a change
 *
 * @beta
 */
export function compareDataFrameStructures(a, b, skipConfig) {
    var e_1, _a;
    var _b, _c;
    if (a === b) {
        return true;
    }
    if (((_b = a === null || a === void 0 ? void 0 : a.fields) === null || _b === void 0 ? void 0 : _b.length) !== ((_c = b === null || b === void 0 ? void 0 : b.fields) === null || _c === void 0 ? void 0 : _c.length)) {
        return false;
    }
    if (a.name !== b.name) {
        return false;
    }
    for (var i = 0; i < a.fields.length; i++) {
        var fA = a.fields[i];
        var fB = b.fields[i];
        if (fA.type !== fB.type || fA.name !== fB.name) {
            return false;
        }
        // Do not check the config fields
        if (skipConfig) {
            continue;
        }
        // Check if labels are different
        if (fA.labels && fB.labels && !shallowCompare(fA.labels, fB.labels)) {
            return false;
        }
        var cfgA = fA.config;
        var cfgB = fB.config;
        var aKeys = Object.keys(cfgA);
        var bKeys = Object.keys(cfgB);
        if (aKeys.length !== bKeys.length) {
            return false;
        }
        try {
            for (var aKeys_1 = (e_1 = void 0, __values(aKeys)), aKeys_1_1 = aKeys_1.next(); !aKeys_1_1.done; aKeys_1_1 = aKeys_1.next()) {
                var key = aKeys_1_1.value;
                if (!(key in cfgB)) {
                    return false;
                }
                if (key === 'custom') {
                    if (!shallowCompare(cfgA[key], cfgB[key])) {
                        return false;
                    }
                }
                else if (cfgA[key] !== cfgB[key]) {
                    return false;
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (aKeys_1_1 && !aKeys_1_1.done && (_a = aKeys_1.return)) _a.call(aKeys_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
    }
    return true;
}
/**
 * Check if all values in two arrays match the compare funciton
 *
 * @beta
 */
export function compareArrayValues(a, b, cmp) {
    if (a === b) {
        return true;
    }
    if ((a === null || a === void 0 ? void 0 : a.length) !== (b === null || b === void 0 ? void 0 : b.length)) {
        return false;
    }
    for (var i = 0; i < a.length; i++) {
        if (!cmp(a[i], b[i])) {
            return false;
        }
    }
    return true;
}
var defaultCmp = function (a, b) { return a === b; };
/**
 * Checks if two objects are equal shallowly
 *
 * @beta
 */
export function shallowCompare(a, b, cmp) {
    var e_2, _a;
    if (cmp === void 0) { cmp = defaultCmp; }
    if (a === b) {
        return true;
    }
    var aKeys = Object.keys(a);
    var bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) {
        return false;
    }
    try {
        for (var aKeys_2 = __values(aKeys), aKeys_2_1 = aKeys_2.next(); !aKeys_2_1.done; aKeys_2_1 = aKeys_2.next()) {
            var key = aKeys_2_1.value;
            //@ts-ignore
            if (!cmp(a[key], b[key])) {
                return false;
            }
        }
    }
    catch (e_2_1) { e_2 = { error: e_2_1 }; }
    finally {
        try {
            if (aKeys_2_1 && !aKeys_2_1.done && (_a = aKeys_2.return)) _a.call(aKeys_2);
        }
        finally { if (e_2) throw e_2.error; }
    }
    return true;
}
//# sourceMappingURL=frameComparisons.js.map