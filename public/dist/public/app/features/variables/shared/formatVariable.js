export var formatVariableLabel = function (variable) {
    if (!isVariableWithOptions(variable)) {
        return variable.name;
    }
    var current = variable.current;
    if (Array.isArray(current.text)) {
        return current.text.join(' + ');
    }
    return current.text;
};
var isVariableWithOptions = function (variable) {
    var _a, _b;
    return (Array.isArray((_a = variable) === null || _a === void 0 ? void 0 : _a.options) ||
        typeof ((_b = variable) === null || _b === void 0 ? void 0 : _b.current) === 'object');
};
//# sourceMappingURL=formatVariable.js.map