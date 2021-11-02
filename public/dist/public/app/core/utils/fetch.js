import { __awaiter, __generator } from "tslib";
import { omitBy } from 'lodash';
import { deprecationWarning } from '@grafana/data';
export var parseInitFromOptions = function (options) {
    var method = options.method;
    var headers = parseHeaders(options);
    var isAppJson = isContentTypeApplicationJson(headers);
    var body = parseBody(options, isAppJson);
    var credentials = parseCredentials(options);
    return {
        method: method,
        headers: headers,
        body: body,
        credentials: credentials,
    };
};
var defaultHeaderParser = {
    canParse: function () { return true; },
    parse: function (headers) {
        var accept = headers.get('accept');
        if (accept) {
            return headers;
        }
        headers.set('accept', 'application/json, text/plain, */*');
        return headers;
    },
};
var parseHeaderByMethodFactory = function (methodPredicate) { return ({
    canParse: function (options) {
        var method = (options === null || options === void 0 ? void 0 : options.method) ? options === null || options === void 0 ? void 0 : options.method.toLowerCase() : '';
        return method === methodPredicate;
    },
    parse: function (headers) {
        var contentType = headers.get('content-type');
        if (contentType) {
            return headers;
        }
        headers.set('content-type', 'application/json');
        return headers;
    },
}); };
var postHeaderParser = parseHeaderByMethodFactory('post');
var putHeaderParser = parseHeaderByMethodFactory('put');
var patchHeaderParser = parseHeaderByMethodFactory('patch');
var headerParsers = [postHeaderParser, putHeaderParser, patchHeaderParser, defaultHeaderParser];
export var parseHeaders = function (options) {
    var headers = (options === null || options === void 0 ? void 0 : options.headers) ? new Headers(options.headers) : new Headers();
    var parsers = headerParsers.filter(function (parser) { return parser.canParse(options); });
    var combinedHeaders = parsers.reduce(function (prev, parser) {
        return parser.parse(prev);
    }, headers);
    return combinedHeaders;
};
export var isContentTypeApplicationJson = function (headers) {
    if (!headers) {
        return false;
    }
    var contentType = headers.get('content-type');
    if (contentType && contentType.toLowerCase() === 'application/json') {
        return true;
    }
    return false;
};
export var parseBody = function (options, isAppJson) {
    if (!options) {
        return options;
    }
    if (!options.data || typeof options.data === 'string') {
        return options.data;
    }
    return isAppJson ? JSON.stringify(options.data) : new URLSearchParams(options.data);
};
export function parseResponseBody(response, responseType) {
    return __awaiter(this, void 0, void 0, function () {
        var textData;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (responseType) {
                        switch (responseType) {
                            case 'arraybuffer':
                                return [2 /*return*/, response.arrayBuffer()];
                            case 'blob':
                                return [2 /*return*/, response.blob()];
                            case 'json':
                                return [2 /*return*/, response.json()];
                            case 'text':
                                return [2 /*return*/, response.text()];
                        }
                    }
                    return [4 /*yield*/, response.text()];
                case 1:
                    textData = _a.sent();
                    try {
                        return [2 /*return*/, JSON.parse(textData)]; // majority of the requests this will be something that can be parsed
                    }
                    catch (_b) { }
                    return [2 /*return*/, textData];
            }
        });
    });
}
export function serializeParams(data) {
    return Object.keys(data)
        .map(function (key) {
        var value = data[key];
        if (Array.isArray(value)) {
            return value.map(function (arrayValue) { return encodeURIComponent(key) + "=" + encodeURIComponent(arrayValue); }).join('&');
        }
        return encodeURIComponent(key) + "=" + encodeURIComponent(value);
    })
        .join('&');
}
export var parseUrlFromOptions = function (options) {
    var cleanParams = omitBy(options.params, function (v) { return v === undefined || (v && v.length === 0); });
    var serializedParams = serializeParams(cleanParams);
    return options.params && serializedParams.length ? options.url + "?" + serializedParams : options.url;
};
export var parseCredentials = function (options) {
    if (!options) {
        return options;
    }
    if (options.credentials) {
        return options.credentials;
    }
    if (options.withCredentials) {
        deprecationWarning('BackendSrvRequest', 'withCredentials', 'credentials');
        return 'include';
    }
    return 'same-origin';
};
//# sourceMappingURL=fetch.js.map