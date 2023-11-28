export var EventsWithValidation;
(function (EventsWithValidation) {
    EventsWithValidation["onBlur"] = "onBlur";
    EventsWithValidation["onFocus"] = "onFocus";
    EventsWithValidation["onChange"] = "onChange";
})(EventsWithValidation || (EventsWithValidation = {}));
export const validate = (value, validationRules) => {
    const errors = validationRules.reduce((acc, currRule) => {
        if (!currRule.rule(value)) {
            return acc.concat(currRule.errorMessage);
        }
        return acc;
    }, []);
    return errors.length > 0 ? errors : null;
};
export const hasValidationEvent = (event, validationEvents) => {
    return validationEvents && validationEvents[event];
};
export const regexValidation = (pattern, errorMessage) => {
    return {
        rule: (valueToValidate) => {
            return !!valueToValidate.match(pattern);
        },
        errorMessage: errorMessage || 'Value is not valid',
    };
};
//# sourceMappingURL=validate.js.map