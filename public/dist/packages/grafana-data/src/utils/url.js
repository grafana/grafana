/**
 * @preserve jquery-param (c) 2015 KNOWLEDGECODE | MIT
 */
import { __read, __spreadArray, __values } from "tslib";
function renderUrl(path, query) {
    if (query && Object.keys(query).length > 0) {
        path += '?' + toUrlParams(query);
    }
    return path;
}
function encodeURIComponentAsAngularJS(val, pctEncodeSpaces) {
    return encodeURIComponent(val)
        .replace(/%40/gi, '@')
        .replace(/%3A/gi, ':')
        .replace(/%24/g, '$')
        .replace(/%2C/gi, ',')
        .replace(/%3B/gi, ';')
        .replace(/%20/g, pctEncodeSpaces ? '%20' : '+');
}
function toUrlParams(a) {
    var s = [];
    var rbracket = /\[\]$/;
    var isArray = function (obj) {
        return Object.prototype.toString.call(obj) === '[object Array]';
    };
    var add = function (k, v) {
        v = typeof v === 'function' ? v() : v === null ? '' : v === undefined ? '' : v;
        if (typeof v !== 'boolean') {
            s[s.length] = encodeURIComponentAsAngularJS(k, true) + '=' + encodeURIComponentAsAngularJS(v, true);
        }
        else {
            var valueQueryPart = v ? '' : '=' + encodeURIComponentAsAngularJS('false', true);
            s[s.length] = encodeURIComponentAsAngularJS(k, true) + valueQueryPart;
        }
    };
    var buildParams = function (prefix, obj) {
        var i, len, key;
        if (prefix) {
            if (isArray(obj)) {
                for (i = 0, len = obj.length; i < len; i++) {
                    if (rbracket.test(prefix)) {
                        add(prefix, obj[i]);
                    }
                    else {
                        buildParams(prefix, obj[i]);
                    }
                }
            }
            else if (obj && String(obj) === '[object Object]') {
                for (key in obj) {
                    buildParams(prefix + '[' + key + ']', obj[key]);
                }
            }
            else {
                add(prefix, obj);
            }
        }
        else if (isArray(obj)) {
            for (i = 0, len = obj.length; i < len; i++) {
                add(obj[i].name, obj[i].value);
            }
        }
        else {
            for (key in obj) {
                buildParams(key, obj[key]);
            }
        }
        return s;
    };
    return buildParams('', a).join('&');
}
function appendQueryToUrl(url, stringToAppend) {
    if (stringToAppend !== undefined && stringToAppend !== null && stringToAppend !== '') {
        var pos = url.indexOf('?');
        if (pos !== -1) {
            if (url.length - pos > 1) {
                url += '&';
            }
        }
        else {
            url += '?';
        }
        url += stringToAppend;
    }
    return url;
}
/**
 * Return search part (as object) of current url
 */
function getUrlSearchParams() {
    var e_1, _a;
    var search = window.location.search.substring(1);
    var searchParamsSegments = search.split('&');
    var params = {};
    try {
        for (var searchParamsSegments_1 = __values(searchParamsSegments), searchParamsSegments_1_1 = searchParamsSegments_1.next(); !searchParamsSegments_1_1.done; searchParamsSegments_1_1 = searchParamsSegments_1.next()) {
            var p = searchParamsSegments_1_1.value;
            var keyValuePair = p.split('=');
            if (keyValuePair.length > 1) {
                // key-value param
                var key = decodeURIComponent(keyValuePair[0]);
                var value = decodeURIComponent(keyValuePair[1]);
                if (key in params) {
                    params[key] = __spreadArray(__spreadArray([], __read(params[key]), false), [value], false);
                }
                else {
                    params[key] = [value];
                }
            }
            else if (keyValuePair.length === 1) {
                // boolean param
                var key = decodeURIComponent(keyValuePair[0]);
                params[key] = true;
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (searchParamsSegments_1_1 && !searchParamsSegments_1_1.done && (_a = searchParamsSegments_1.return)) _a.call(searchParamsSegments_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return params;
}
/**
 * Parses an escaped url query string into key-value pairs.
 * Attribution: Code dervived from https://github.com/angular/angular.js/master/src/Angular.js#L1396
 * @returns {Object.<string,boolean|Array>}
 */
export function parseKeyValue(keyValue) {
    var e_2, _a;
    var obj = {};
    var parts = (keyValue || '').split('&');
    try {
        for (var parts_1 = __values(parts), parts_1_1 = parts_1.next(); !parts_1_1.done; parts_1_1 = parts_1.next()) {
            var keyValue_1 = parts_1_1.value;
            var splitPoint = void 0;
            var key = void 0;
            var val = void 0;
            if (keyValue_1) {
                key = keyValue_1 = keyValue_1.replace(/\+/g, '%20');
                splitPoint = keyValue_1.indexOf('=');
                if (splitPoint !== -1) {
                    key = keyValue_1.substring(0, splitPoint);
                    val = keyValue_1.substring(splitPoint + 1);
                }
                key = tryDecodeURIComponent(key);
                if (key !== undefined) {
                    val = val !== undefined ? tryDecodeURIComponent(val) : true;
                    var parsedVal = void 0;
                    if (typeof val === 'string' && val !== '') {
                        parsedVal = val === 'true' || val === 'false' ? val === 'true' : val;
                    }
                    else {
                        parsedVal = val;
                    }
                    if (!obj.hasOwnProperty(key)) {
                        obj[key] = isNaN(parsedVal) ? val : parsedVal;
                    }
                    else if (Array.isArray(obj[key])) {
                        obj[key].push(val);
                    }
                    else {
                        obj[key] = [obj[key], isNaN(parsedVal) ? val : parsedVal];
                    }
                }
            }
        }
    }
    catch (e_2_1) { e_2 = { error: e_2_1 }; }
    finally {
        try {
            if (parts_1_1 && !parts_1_1.done && (_a = parts_1.return)) _a.call(parts_1);
        }
        finally { if (e_2) throw e_2.error; }
    }
    return obj;
}
function tryDecodeURIComponent(value) {
    try {
        return decodeURIComponent(value);
    }
    catch (e) {
        return undefined;
    }
}
export var urlUtil = {
    renderUrl: renderUrl,
    toUrlParams: toUrlParams,
    appendQueryToUrl: appendQueryToUrl,
    getUrlSearchParams: getUrlSearchParams,
    parseKeyValue: parseKeyValue,
};
export function serializeStateToUrlParam(urlState, compact) {
    if (compact) {
        return JSON.stringify(__spreadArray([urlState.range.from, urlState.range.to, urlState.datasource], __read(urlState.queries), false));
    }
    return JSON.stringify(urlState);
}
//# sourceMappingURL=url.js.map