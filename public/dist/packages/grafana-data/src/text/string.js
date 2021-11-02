import { camelCase } from 'lodash';
var specialChars = ['(', '[', '{', '}', ']', ')', '|', '*', '+', '-', '.', '?', '<', '>', '#', '&', '^', '$'];
export var escapeStringForRegex = function (value) {
    if (!value) {
        return value;
    }
    return specialChars.reduce(function (escaped, currentChar) { return escaped.replace(currentChar, '\\' + currentChar); }, value);
};
export var unEscapeStringFromRegex = function (value) {
    if (!value) {
        return value;
    }
    return specialChars.reduce(function (escaped, currentChar) { return escaped.replace('\\' + currentChar, currentChar); }, value);
};
export function stringStartsAsRegEx(str) {
    if (!str) {
        return false;
    }
    return str[0] === '/';
}
export function stringToJsRegex(str) {
    if (!stringStartsAsRegEx(str)) {
        return new RegExp("^" + str + "$");
    }
    var match = str.match(new RegExp('^/(.*?)/(g?i?m?y?)$'));
    if (!match) {
        throw new Error("'" + str + "' is not a valid regular expression.");
    }
    return new RegExp(match[1], match[2]);
}
export function stringToMs(str) {
    if (!str) {
        return 0;
    }
    var nr = parseInt(str, 10);
    var unit = str.substr(String(nr).length);
    var s = 1000;
    var m = s * 60;
    var h = m * 60;
    var d = h * 24;
    switch (unit) {
        case 's':
            return nr * s;
        case 'm':
            return nr * m;
        case 'h':
            return nr * h;
        case 'd':
            return nr * d;
        default:
            if (!unit) {
                return isNaN(nr) ? 0 : nr;
            }
            throw new Error('Not supported unit: ' + unit);
    }
}
export function toNumberString(value) {
    if (value !== null && value !== undefined && Number.isFinite(value)) {
        return value.toString();
    }
    return '';
}
export function toIntegerOrUndefined(value) {
    if (!value) {
        return undefined;
    }
    var v = parseInt(value, 10);
    return isNaN(v) ? undefined : v;
}
export function toFloatOrUndefined(value) {
    if (!value) {
        return undefined;
    }
    var v = parseFloat(value);
    return isNaN(v) ? undefined : v;
}
export var toPascalCase = function (string) {
    var str = camelCase(string);
    return str.charAt(0).toUpperCase() + str.substring(1);
};
//# sourceMappingURL=string.js.map