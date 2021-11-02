// Based on work https://github.com/mohsen1/json-formatter-js
// License MIT, Copyright (c) 2015 Mohsen Azimi
/*
 * Escapes `"` characters from string
 */
function escapeString(str) {
    return str.replace('"', '"');
}
/*
 * Determines if a value is an object
 */
export function isObject(value) {
    var type = typeof value;
    return !!value && type === 'object';
}
/*
 * Gets constructor name of an object.
 * From http://stackoverflow.com/a/332429
 *
 */
export function getObjectName(object) {
    if (object === undefined) {
        return '';
    }
    if (object === null) {
        return 'Object';
    }
    if (typeof object === 'object' && !object.constructor) {
        return 'Object';
    }
    var funcNameRegex = /function ([^(]*)/;
    var results = funcNameRegex.exec(object.constructor.toString());
    if (results && results.length > 1) {
        return results[1];
    }
    else {
        return '';
    }
}
/*
 * Gets type of an object. Returns "null" for null objects
 */
export function getType(object) {
    if (object === null) {
        return 'null';
    }
    return typeof object;
}
/*
 * Generates inline preview for a JavaScript object based on a value
 */
export function getValuePreview(object, value) {
    var type = getType(object);
    if (type === 'null' || type === 'undefined') {
        return type;
    }
    if (type === 'string') {
        value = '"' + escapeString(value) + '"';
    }
    if (type === 'function') {
        // Remove content of the function
        return (object
            .toString()
            .replace(/[\r\n]/g, '')
            .replace(/\{.*\}/, '') + '{…}');
    }
    return value;
}
/*
 * Generates inline preview for a JavaScript object
 */
var value = '';
export function getPreview(obj) {
    if (isObject(obj)) {
        value = getObjectName(obj);
        if (Array.isArray(obj)) {
            value += '[' + obj.length + ']';
        }
    }
    else {
        value = getValuePreview(obj, obj.toString());
    }
    return value;
}
/*
 * Generates a prefixed CSS class name
 */
export function cssClass(className) {
    return "json-formatter-" + className;
}
/*
 * Creates a new DOM element with given type and class
 * TODO: move me to helpers
 */
export function createElement(type, className, content) {
    var el = document.createElement(type);
    if (className) {
        el.classList.add(cssClass(className));
    }
    if (content !== undefined) {
        if (content instanceof Node) {
            el.appendChild(content);
        }
        else {
            el.appendChild(document.createTextNode(String(content)));
        }
    }
    return el;
}
//# sourceMappingURL=helpers.js.map