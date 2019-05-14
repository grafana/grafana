import React, { forwardRef } from 'react';
var specialChars = ['(', '[', '{', '}', ']', ')', '|', '*', '+', '-', '.', '?', '<', '>', '#', '&', '^', '$'];
export var escapeStringForRegex = function (value) {
    if (!value) {
        return value;
    }
    var newValue = specialChars.reduce(function (escaped, currentChar) { return escaped.replace(currentChar, '\\' + currentChar); }, value);
    return newValue;
};
export var unEscapeStringFromRegex = function (value) {
    if (!value) {
        return value;
    }
    var newValue = specialChars.reduce(function (escaped, currentChar) { return escaped.replace('\\' + currentChar, currentChar); }, value);
    return newValue;
};
export var FilterInput = forwardRef(function (props, ref) { return (React.createElement("label", { className: props.labelClassName },
    React.createElement("input", { ref: ref, type: "text", className: props.inputClassName, value: unEscapeStringFromRegex(props.value), onChange: function (event) { return props.onChange(escapeStringForRegex(event.target.value)); }, placeholder: props.placeholder ? props.placeholder : null }),
    React.createElement("i", { className: "gf-form-input-icon fa fa-search" }))); });
//# sourceMappingURL=FilterInput.js.map