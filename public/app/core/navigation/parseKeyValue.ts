// tslint:disable
// Most of this file is just a copy of some content from
// https://github.com/angular/angular.js/blob/937fb891fa4fcf79e9fa02f8e0d517593e781077/src/Angular.js
// Long term this code should be refactored to tru-type-script ;)
// tslint disabled on purpose

const getPrototypeOf = Object.getPrototypeOf;
const toString = Object.prototype.toString;
const hasOwnProperty = Object.prototype.hasOwnProperty;

let jqLite: any;

export function isArray(arr: any) {
  return Array.isArray(arr) || arr instanceof Array;
}

export function isError(value: any) {
  const tag = toString.call(value);
  switch (tag) {
    case '[object Error]':
      return true;
    case '[object Exception]':
      return true;
    case '[object DOMException]':
      return true;
    default:
      return value instanceof Error;
  }
}
export function isDate(value: any) {
  return toString.call(value) === '[object Date]';
}
export function isNumber(value: any) {
  return typeof value === 'number';
}

export function isString(value: any) {
  return typeof value === 'string';
}
export function isBlankObject(value: any) {
  return value !== null && typeof value === 'object' && !getPrototypeOf(value);
}
export function isObject(value: any) {
  // http://jsperf.com/isobject4
  return value !== null && typeof value === 'object';
}

export function isWindow(obj: { window: any }) {
  return obj && obj.window === obj;
}

export function isArrayLike(obj: any) {
  // `null`, `undefined` and `window` are not array-like
  if (obj == null || isWindow(obj)) {
    return false;
  }

  // arrays, strings and jQuery/jqLite objects are array like
  // * jqLite is either the jQuery or jqLite constructor function
  // * we have to check the existence of jqLite first as this method is called
  //   via the forEach method when constructing the jqLite object in the first place
  if (isArray(obj) || isString(obj) || (jqLite && obj instanceof jqLite)) {
    return true;
  }

  // Support: iOS 8.2 (not reproducible in simulator)
  // "length" in obj used to prevent JIT error (gh-11508)
  const length = 'length' in Object(obj) && obj.length;

  // NodeList objects (with `item` method) and
  // other objects with suitable length characteristics are array-like
  return isNumber(length) && ((length >= 0 && length - 1 in obj) || typeof obj.item === 'function');
}
export function isFunction(value: any) {
  return typeof value === 'function';
}

export function forEach(obj: any, iterator: any, context?: any) {
  let key, length;
  if (obj) {
    if (isFunction(obj)) {
      for (key in obj) {
        if (key !== 'prototype' && key !== 'length' && key !== 'name' && obj.hasOwnProperty(key)) {
          iterator.call(context, obj[key], key, obj);
        }
      }
    } else if (isArray(obj) || isArrayLike(obj)) {
      const isPrimitive = typeof obj !== 'object';
      for (key = 0, length = obj.length; key < length; key++) {
        if (isPrimitive || key in obj) {
          iterator.call(context, obj[key], key, obj);
        }
      }
    } else if (obj.forEach && obj.forEach !== forEach) {
      obj.forEach(iterator, context, obj);
    } else if (isBlankObject(obj)) {
      // createMap() fast path --- Safe to avoid hasOwnProperty check because prototype chain is empty
      for (key in obj) {
        iterator.call(context, obj[key], key, obj);
      }
    } else if (typeof obj.hasOwnProperty === 'function') {
      // Slow path for objects inheriting Object.prototype, hasOwnProperty check needed
      for (key in obj) {
        if (obj.hasOwnProperty(key)) {
          iterator.call(context, obj[key], key, obj);
        }
      }
    } else {
      // Slow path for objects which do not have a method `hasOwnProperty`
      for (key in obj) {
        if (hasOwnProperty.call(obj, key)) {
          iterator.call(context, obj[key], key, obj);
        }
      }
    }
  }
  return obj;
}
export function tryDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch (e) {
    // Ignore any invalid uri component.
    return '';
  }
}

function parseKeyValue(keyValue: string | null) {
  const obj = {};
  forEach((keyValue || '').split('&'), function (keyValue: string) {
    let splitPoint, key, val;
    if (keyValue) {
      key = keyValue = keyValue.replace(/\+/g, '%20');
      splitPoint = keyValue.indexOf('=');
      if (splitPoint !== -1) {
        key = keyValue.substring(0, splitPoint);
        val = keyValue.substring(splitPoint + 1);
      }
      key = tryDecodeURIComponent(key);
      if (key) {
        val = val !== undefined ? tryDecodeURIComponent(val) : true;
        if (!hasOwnProperty.call(obj, key)) {
          // @ts-ignore
          obj[key] = val;
          // @ts-ignore
        } else if (isArray(obj[key])) {
          // @ts-ignore
          obj[key].push(val);
        } else {
          // @ts-ignore
          obj[key] = [obj[key], val];
        }
      }
    }
  });
  return obj;
}

export default parseKeyValue;

// tslint:enable
