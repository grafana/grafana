export var validate = function (value, validationRules) {
    var errors = validationRules.reduce(function (acc, currRule) {
        if (!currRule.rule(value)) {
            return acc.concat(currRule.errorMessage);
        }
        return acc;
    }, []);
    return errors.length > 0 ? errors : null;
};
export var hasValidationEvent = function (event, validationEvents) {
    return validationEvents && validationEvents[event];
};
//# sourceMappingURL=validate.js.map