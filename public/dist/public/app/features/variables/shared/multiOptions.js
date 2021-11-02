import { __assign } from "tslib";
export var alignCurrentWithMulti = function (current, value) {
    if (!current) {
        return current;
    }
    if (value && !Array.isArray(current.value)) {
        return __assign(__assign({}, current), { value: convertToMulti(current.value), text: convertToMulti(current.text) });
    }
    if (!value && Array.isArray(current.value)) {
        return __assign(__assign({}, current), { value: convertToSingle(current.value), text: convertToSingle(current.text) });
    }
    return current;
};
var convertToSingle = function (value) {
    if (!Array.isArray(value)) {
        return value;
    }
    if (value.length > 0) {
        return value[0];
    }
    return '';
};
var convertToMulti = function (value) {
    if (Array.isArray(value)) {
        return value;
    }
    return [value];
};
//# sourceMappingURL=multiOptions.js.map