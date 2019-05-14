/**
 * @preserve jquery-param (c) 2015 KNOWLEDGECODE | MIT
 */
export function renderUrl(path, query) {
    if (query && Object.keys(query).length > 0) {
        path += '?' + toUrlParams(query);
    }
    return path;
}
export function encodeURIComponentAsAngularJS(val, pctEncodeSpaces) {
    return encodeURIComponent(val)
        .replace(/%40/gi, '@')
        .replace(/%3A/gi, ':')
        .replace(/%24/g, '$')
        .replace(/%2C/gi, ',')
        .replace(/%3B/gi, ';')
        .replace(/%20/g, pctEncodeSpaces ? '%20' : '+');
}
export function toUrlParams(a) {
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
            s[s.length] = encodeURIComponentAsAngularJS(k, true);
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
//# sourceMappingURL=url.js.map