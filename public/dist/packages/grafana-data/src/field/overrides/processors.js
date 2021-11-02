export var identityOverrideProcessor = function (value, _context, _settings) {
    return value;
};
export var numberOverrideProcessor = function (value, context, settings) {
    if (value === undefined || value === null) {
        return undefined;
    }
    return parseFloat(value);
};
export var displayNameOverrideProcessor = function (value, context, settings) {
    var _a, _b;
    // clear the cached display name
    (_b = (_a = context.field) === null || _a === void 0 ? void 0 : _a.state) === null || _b === void 0 ? true : delete _b.displayName;
    return stringOverrideProcessor(value, context, settings);
};
export var dataLinksOverrideProcessor = function (value, _context, _settings) {
    return value;
};
export var valueMappingsOverrideProcessor = function (value, _context, _settings) {
    return value; // !!!! likely not !!!!
};
export var selectOverrideProcessor = function (value, _context, _settings) {
    return value;
};
export var stringOverrideProcessor = function (value, context, settings) {
    if (value === null || value === undefined) {
        return value;
    }
    if (settings && settings.expandTemplateVars && context.replaceVariables) {
        return context.replaceVariables(value, context.field.state.scopedVars);
    }
    return "" + value;
};
export var thresholdsOverrideProcessor = function (value, _context, _settings) {
    return value; // !!!! likely not !!!!
};
export var unitOverrideProcessor = function (value, _context, _settings) {
    return value;
};
export var booleanOverrideProcessor = function (value, _context, _settings) {
    return value; // !!!! likely not !!!!
};
//# sourceMappingURL=processors.js.map