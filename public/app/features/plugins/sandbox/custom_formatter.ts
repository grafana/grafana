// Original code from https://github.com/salesforce/near-membrane/blob/main/packages/near-membrane-dom/src/custom-devtools-formatter.ts
import {
  ArrayIsArray,
  ArrayProtoFilter,
  ArrayProtoIncludes,
  ArrayProtoPush,
  ArrayProtoSort,
  ArrayProtoUnshift,
  CHAR_ELLIPSIS,
  getNearMembraneProxySerializedValue,
  isNearMembraneProxy,
  isObject,
  JSONStringify,
  LOCKER_UNMINIFIED_FLAG,
  MathMin,
  NumberIsFinite,
  NumberIsInteger,
  ObjectKeys,
  ObjectProtoToString,
  ReflectApply,
  ReflectDefineProperty,
  ReflectOwnKeys,
  StringCtor,
  StringProtoSlice,
  SymbolFor,
  TO_STRING_BRAND_BIG_INT,
  TO_STRING_BRAND_BOOLEAN,
  TO_STRING_BRAND_NUMBER,
  TO_STRING_BRAND_STRING,
  TO_STRING_BRAND_SYMBOL,
} from '@locker/near-membrane-shared';
import { rootWindow } from '@locker/near-membrane-shared-dom';

declare global {
  interface Window {
    devtoolsFormatters: any[];
  }
}

// This package is bundled by third-parties that have their own build time
// replacement logic. Instead of customizing each build system to be aware
// of this package we implement a two phase debug mode by performing small
// runtime checks to determine phase one, our code is unminified, and
// phase two, the user opted-in to custom devtools formatters. Phase one
// is used for light weight initialization time debug while phase two is
// reserved for post initialization runtime.

// istanbul ignore else: not avoidable via tests
if (LOCKER_UNMINIFIED_FLAG) {
  // We passed the phase one gate so we know our code is unminified and we can
  // install Locker's custom devtools formatter.
  let lockerDebugModeSymbolFlag = true;

  const LOCKER_DEBUG_MODE_SYMBOL = SymbolFor('@@lockerDebugMode');
  const MAX_ARRAY_DISPLAY = 100;
  const MAX_OBJECT_DISPLAY = 5;
  const MAX_STRING_DISPLAY = 100;
  const MID_STRING_DISPLAY = MAX_STRING_DISPLAY / 2;

  const headerCSSText =
    'display: inline-block; margin-bottom: 3px; margin-left: -3px; word-break: break-all; word-wrap: wrap;';
  const bodyItemStyleObject = { style: 'margin-left:11px; margin-bottom: 3px;' };
  const bodyStyleObject = {
    style: 'display: inline-block; margin-left:12px; word-break: break-all; word-wrap: wrap;',
  };
  const keyEnumerableStringStyleObject = { style: 'color: #9d288c; font-weight: bold' };
  const keyNonEnumerableOrSymbolStyleObject = { style: 'color: #b17ab0' };
  const primitiveBlueColorStyleObject = { style: 'color: #16239f' };
  const primitiveGreenColorStyleObject = { style: 'color: #236d25' };
  const primitiveGreyColorStyleObject = { style: 'color: #606367' };
  const primitiveOrangeColorStyleObject = { style: 'color: #b82619' };

  // istanbul ignore next: currently unreachable via tests
  const formatValue = function formatValue(value: any) {
    if (value === null || value === undefined) {
      return ['span', primitiveGreyColorStyleObject, `${value}`];
    }
    if (typeof value === 'boolean') {
      return ['span', primitiveBlueColorStyleObject, value];
    }
    if (typeof value === 'number') {
      return NumberIsFinite(value)
        ? ['span', primitiveBlueColorStyleObject, value]
        : ['span', primitiveBlueColorStyleObject, `${value >= 0 ? '' : '-'}Infinity`];
    }
    if (typeof value === 'string') {
      let string = value as any;
      const { length } = string;
      if (length > MAX_STRING_DISPLAY) {
        const firstChunk = ReflectApply(StringProtoSlice, string, [0, MID_STRING_DISPLAY]);
        const lastChunk = ReflectApply(StringProtoSlice, string, [length - MID_STRING_DISPLAY - 1, length]);
        string = firstChunk + CHAR_ELLIPSIS + lastChunk;
      }
      // @TODO: Default to using single quotes on main header and double
      // quotes on body.
      return ['span', primitiveOrangeColorStyleObject, JSONStringify(string)];
    }
    if (ArrayIsArray(value)) {
      return ['span', {}, `Array(${value.length})`];
    }
    if (isObject(value)) {
      return ['span', {}, `{${CHAR_ELLIPSIS}}`];
    }
    // Symbol will be coerced to a string.
    return ['span', primitiveOrangeColorStyleObject, StringCtor(value)];
  };
  // istanbul ignore next: currently unreachable via tests
  const formatHeader = function formatHeader(object: any, config: any) {
    const isChildElement = config?.isChildElement;
    const formattedHeader: any[] = [];
    let formattedHeaderOffset = 0;
    if (isChildElement) {
      formattedHeader[formattedHeaderOffset++] = ['span', keyEnumerableStringStyleObject, config.childKey];
      formattedHeader[formattedHeaderOffset++] = ['span', {}, ': '];
    }
    const brand = ReflectApply(ObjectProtoToString, object, []);
    let keys = ObjectKeys(object);
    if (brand === TO_STRING_BRAND_SYMBOL) {
      if (!ReflectApply(ArrayProtoIncludes, keys, ['description'])) {
        ReflectApply(ArrayProtoUnshift, keys, ['description']);
      }
    } else if (brand === TO_STRING_BRAND_STRING) {
      const { length } = object;
      keys = ReflectApply(ArrayProtoFilter, keys, [
        (key: PropertyKey) => {
          const possibleIndex = typeof key === 'string' ? +key : -1;
          return possibleIndex < 0 || possibleIndex >= length || !NumberIsInteger(possibleIndex);
        },
      ]);
    }
    const { length: keysLength } = keys;
    if (ArrayIsArray(object)) {
      formattedHeader[formattedHeaderOffset++] = [
        'span',
        isChildElement ? primitiveGreyColorStyleObject : {},
        `(${object.length}) [`,
      ];
      for (let i = 0, length = MathMin(keysLength, MAX_ARRAY_DISPLAY); i < length; i += 1) {
        const key = keys[i];
        const value = (object as any)[key];
        formattedHeader[formattedHeaderOffset++] = ['span', {}, i ? ', ' : ''];
        formattedHeader[formattedHeaderOffset++] = formatValue(value);
      }
      if (keysLength > MAX_ARRAY_DISPLAY) {
        formattedHeader[formattedHeaderOffset++] = ['span', null, ['span', {}, `, ${CHAR_ELLIPSIS}`]];
      }
      formattedHeader[formattedHeaderOffset++] = ['span', {}, ']'];
      return formattedHeader;
    }
    let boxedHeaderEntry: any[] | undefined;
    let headerOpening = '{';
    // eslint-disable-next-line default-case
    switch (brand) {
      case TO_STRING_BRAND_BIG_INT:
      case TO_STRING_BRAND_BOOLEAN:
      case TO_STRING_BRAND_NUMBER:
      case TO_STRING_BRAND_STRING:
      case TO_STRING_BRAND_SYMBOL: {
        let colorStyleObject = primitiveBlueColorStyleObject;
        if (brand === TO_STRING_BRAND_BIG_INT) {
          colorStyleObject = primitiveGreenColorStyleObject;
        } else if (brand === TO_STRING_BRAND_SYMBOL) {
          colorStyleObject = primitiveOrangeColorStyleObject;
        }
        headerOpening = `${ReflectApply(StringProtoSlice, brand, [8, -1])} {`;
        boxedHeaderEntry = ['span', colorStyleObject, `${StringCtor(getNearMembraneProxySerializedValue(object))}`];
        break;
      }
    }
    formattedHeader[formattedHeaderOffset++] = ['span', {}, headerOpening];
    if (boxedHeaderEntry) {
      formattedHeader[formattedHeaderOffset++] = boxedHeaderEntry;
      if (keysLength) {
        formattedHeader[formattedHeaderOffset++] = ['span', {}, ', '];
      }
    }
    for (let i = 0, length = MathMin(keysLength, MAX_OBJECT_DISPLAY); i < length; i += 1) {
      const key = keys[i];
      const value = object[key];
      formattedHeader[formattedHeaderOffset++] = ['span', {}, i ? ', ' : ''];
      formattedHeader[formattedHeaderOffset++] = ['span', primitiveGreyColorStyleObject, key];
      formattedHeader[formattedHeaderOffset++] = ['span', {}, ': '];
      formattedHeader[formattedHeaderOffset++] = formatValue(value);
    }
    if (keysLength > MAX_OBJECT_DISPLAY) {
      formattedHeader[formattedHeaderOffset++] = ['span', null, ['span', {}, `, ${CHAR_ELLIPSIS}`]];
    }
    formattedHeader[formattedHeaderOffset++] = ['span', {}, '}'];
    return formattedHeader;
  };
  // istanbul ignore next: currently unreachable via tests
  const formatBody = function formatBody(object: object) {
    const keys = ObjectKeys(object);
    // @TODO: Arrays are broken into groups of 100.
    const ownKeys = ReflectOwnKeys(object);
    if (!ArrayIsArray(object)) {
      ReflectApply(ArrayProtoSort, ownKeys, []);
    }
    const formattedBody: any[] = [];
    let formattedBodyOffset = 0;
    for (let i = 0, { length } = ownKeys; i < length; i += 1) {
      const ownKey = ownKeys[i];
      const value = (object as any)[ownKey];
      if (isObject(value)) {
        formattedBody[formattedBodyOffset++] = [
          'div',
          {},
          [
            'object',
            {
              object: value,
              config: { childKey: StringCtor(ownKey), isChildElement: true },
            },
          ],
        ];
      } else {
        let currentKeyStyle = keyEnumerableStringStyleObject;
        if (typeof ownKey === 'symbol' || !ReflectApply(ArrayProtoIncludes, keys, [ownKey])) {
          currentKeyStyle = keyNonEnumerableOrSymbolStyleObject;
        }
        formattedBody[formattedBodyOffset++] = [
          'div',
          bodyItemStyleObject,
          ['span', currentKeyStyle, StringCtor(ownKey)],
          ['span', {}, ': '],
          formatValue(value),
        ];
      }
    }
    return formattedBody;
  };

  let { devtoolsFormatters } = rootWindow;
  if (!ArrayIsArray(devtoolsFormatters)) {
    devtoolsFormatters = [];
    ReflectDefineProperty(rootWindow, 'devtoolsFormatters', {
      __proto__: null,
      configurable: true,
      value: devtoolsFormatters,
      writable: true,
    } as PropertyDescriptor);
  }
  // Append our custom formatter to the array of devtools formatters.

  // istanbul ignore next: currently unreachable via tests
  devtoolsFormatters[devtoolsFormatters.length] = {
    // istanbul ignore next: currently unreachable via tests
    header(object: any, config: any) {
      if (lockerDebugModeSymbolFlag) {
        // We passed the second phase gate so we know that the user has
        // opted-in to custom devtools formatters. Close the gate and
        // define the @@lockerDebugMode symbol on window.
        lockerDebugModeSymbolFlag = false;
        ReflectDefineProperty(rootWindow, LOCKER_DEBUG_MODE_SYMBOL, {
          __proto__: null,
          configurable: true,
          value: true,
          writable: true,
        } as PropertyDescriptor);
      }
      if (!isNearMembraneProxy(object)) {
        return null;
      }
      const headerDiv = ['div', { style: `${headerCSSText}${config?.isChildElement ? '' : 'font-style: italic;'}` }];
      ReflectApply(ArrayProtoPush, headerDiv, formatHeader(object, config));
      return ['div', {}, headerDiv];
    },
    // istanbul ignore next: currently unreachable via tests
    hasBody() {
      return true;
    },
    // istanbul ignore next: currently unreachable via tests
    body(object: object) {
      const bodyDiv = ['div', bodyStyleObject];
      ReflectApply(ArrayProtoPush, bodyDiv, formatBody(object));
      return bodyDiv;
    },
  };
}
