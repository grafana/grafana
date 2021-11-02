export var EventsWithValidation;
(function (EventsWithValidation) {
    EventsWithValidation["onBlur"] = "onBlur";
    EventsWithValidation["onFocus"] = "onFocus";
    EventsWithValidation["onChange"] = "onChange";
})(EventsWithValidation || (EventsWithValidation = {}));
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
export var regexValidation = function (pattern, errorMessage) {
    return {
        rule: function (valueToValidate) {
            return !!valueToValidate.match(pattern);
        },
        errorMessage: errorMessage || 'Value is not valid',
    };
};
//# sourceMappingURL=validate.js.map