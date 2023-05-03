// Based on work https://github.com/mohsen1/json-formatter-js
// License MIT, Copyright (c) 2015 Mohsen Azimi

/*
 * Escapes `"` characters from string
 */
export function formatString(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/*
 * Determines if a value is an object
 */
export function isObject(value: unknown): boolean {
  const type = typeof value;
  return !!value && type === 'object';
}

/*
 * Gets constructor name of an object.
 * From http://stackoverflow.com/a/332429
 *
 */
export function getObjectName(object: object): string {
  if (object === undefined) {
    return '';
  }
  if (object === null) {
    return 'Object';
  }
  if (typeof object === 'object' && !object.constructor) {
    return 'Object';
  }

  const funcNameRegex = /function ([^(]*)/;
  const results = funcNameRegex.exec(object.constructor.toString());
  if (results && results.length > 1) {
    return results[1];
  } else {
    return '';
  }
}

/*
 * Gets type of an object. Returns "null" for null objects
 */
export function getType(object: object): string {
  if (object === null) {
    return 'null';
  }
  return typeof object;
}

/*
 * Generates inline preview for a JavaScript object based on a value
 */
export function getValuePreview(object: object, value: string): string {
  const type = getType(object);

  if (type === 'null' || type === 'undefined') {
    return type;
  }

  if (type === 'string') {
    value = '"' + formatString(value) + '"';
  }
  if (type === 'function') {
    // Remove content of the function
    return (
      object
        .toString()
        .replace(/[\r\n]/g, '')
        .replace(/\{.*\}/, '') + '{…}'
    );
  }
  return value;
}

/*
 * Generates inline preview for a JavaScript object
 */
let value = '';
export function getPreview(obj: object): string {
  if (isObject(obj)) {
    value = getObjectName(obj);
    if (Array.isArray(obj)) {
      value += '[' + obj.length + ']';
    }
  } else {
    value = getValuePreview(obj, obj.toString());
  }
  return value;
}

/*
 * Generates a prefixed CSS class name
 */
export function cssClass(className: string): string {
  return `json-formatter-${className}`;
}

/*
 * Creates a new DOM element with given type and class
 * TODO: move me to helpers
 */
export function createElement(type: string, className?: string, content?: Element | string): Element {
  const el = document.createElement(type);
  if (className) {
    el.classList.add(cssClass(className));
  }
  if (content !== undefined) {
    if (content instanceof Node) {
      el.appendChild(content);
    } else {
      el.appendChild(document.createTextNode(String(content)));
    }
  }
  return el;
}
