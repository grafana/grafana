/* */ 
(function(Buffer) {
  function isArray(arg) {
    if (Array.isArray) {
      return Array.isArray(arg);
    }
    return objectToString(arg) === '[object Array]';
  }
  exports.isArray = isArray;
  function isBoolean(arg) {
    return typeof arg === 'boolean';
  }
  exports.isBoolean = isBoolean;
  function isNull(arg) {
    return arg === null;
  }
  exports.isNull = isNull;
  function isNullOrUndefined(arg) {
    return arg == null;
  }
  exports.isNullOrUndefined = isNullOrUndefined;
  function isNumber(arg) {
    return typeof arg === 'number';
  }
  exports.isNumber = isNumber;
  function isString(arg) {
    return typeof arg === 'string';
  }
  exports.isString = isString;
  function isSymbol(arg) {
    return typeof arg === 'symbol';
  }
  exports.isSymbol = isSymbol;
  function isUndefined(arg) {
    return arg === void 0;
  }
  exports.isUndefined = isUndefined;
  function isRegExp(re) {
    return objectToString(re) === '[object RegExp]';
  }
  exports.isRegExp = isRegExp;
  function isObject(arg) {
    return typeof arg === 'object' && arg !== null;
  }
  exports.isObject = isObject;
  function isDate(d) {
    return objectToString(d) === '[object Date]';
  }
  exports.isDate = isDate;
  function isError(e) {
    return (objectToString(e) === '[object Error]' || e instanceof Error);
  }
  exports.isError = isError;
  function isFunction(arg) {
    return typeof arg === 'function';
  }
  exports.isFunction = isFunction;
  function isPrimitive(arg) {
    return arg === null || typeof arg === 'boolean' || typeof arg === 'number' || typeof arg === 'string' || typeof arg === 'symbol' || typeof arg === 'undefined';
  }
  exports.isPrimitive = isPrimitive;
  exports.isBuffer = Buffer.isBuffer;
  function objectToString(o) {
    return Object.prototype.toString.call(o);
  }
})(require('buffer').Buffer);
