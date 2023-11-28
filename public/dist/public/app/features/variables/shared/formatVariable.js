export const formatVariableLabel = (variable) => {
    if (!isVariableWithOptions(variable)) {
        return variable.name;
    }
    const { current } = variable;
    if (Array.isArray(current.text)) {
        return current.text.join(' + ');
    }
    return current.text;
};
const isVariableWithOptions = (variable) => {
    return (Array.isArray(variable === null || variable === void 0 ? void 0 : variable.options) ||
        typeof (variable === null || variable === void 0 ? void 0 : variable.current) === 'object');
};
//# sourceMappingURL=formatVariable.js.map