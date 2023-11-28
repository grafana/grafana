import { __awaiter } from "tslib";
import { omitBy } from 'lodash';
import { deprecationWarning } from '@grafana/data';
export const parseInitFromOptions = (options) => {
    const method = options.method;
    const headers = parseHeaders(options);
    const isAppJson = isContentTypeApplicationJson(headers);
    const body = parseBody(options, isAppJson);
    const credentials = parseCredentials(options);
    return {
        method,
        headers,
        body,
        credentials,
    };
};
const defaultHeaderParser = {
    canParse: () => true,
    parse: (headers) => {
        const accept = headers.get('accept');
        if (accept) {
            return headers;
        }
        headers.set('accept', 'application/json, text/plain, */*');
        return headers;
    },
};
const parseHeaderByMethodFactory = (methodPredicate) => ({
    canParse: (options) => {
        const method = (options === null || options === void 0 ? void 0 : options.method) ? options === null || options === void 0 ? void 0 : options.method.toLowerCase() : '';
        return method === methodPredicate;
    },
    parse: (headers) => {
        const contentType = headers.get('content-type');
        if (contentType) {
            return headers;
        }
        headers.set('content-type', 'application/json');
        return headers;
    },
});
const postHeaderParser = parseHeaderByMethodFactory('post');
const putHeaderParser = parseHeaderByMethodFactory('put');
const patchHeaderParser = parseHeaderByMethodFactory('patch');
const headerParsers = [postHeaderParser, putHeaderParser, patchHeaderParser, defaultHeaderParser];
export const parseHeaders = (options) => {
    const headers = (options === null || options === void 0 ? void 0 : options.headers) ? new Headers(options.headers) : new Headers();
    const parsers = headerParsers.filter((parser) => parser.canParse(options));
    const combinedHeaders = parsers.reduce((prev, parser) => {
        return parser.parse(prev);
    }, headers);
    return combinedHeaders;
};
export const isContentTypeApplicationJson = (headers) => {
    if (!headers) {
        return false;
    }
    const contentType = headers.get('content-type');
    if (contentType && contentType.toLowerCase() === 'application/json') {
        return true;
    }
    return false;
};
export const parseBody = (options, isAppJson) => {
    if (!options) {
        return options;
    }
    if (!options.data || typeof options.data === 'string') {
        return options.data;
    }
    if (options.data instanceof Blob) {
        return options.data;
    }
    return isAppJson ? JSON.stringify(options.data) : new URLSearchParams(options.data);
};
export function parseResponseBody(response, responseType) {
    return __awaiter(this, void 0, void 0, function* () {
        if (responseType) {
            switch (responseType) {
                case 'arraybuffer':
                    return response.arrayBuffer();
                case 'blob':
                    return response.blob();
                case 'json':
                    // An empty string is not a valid JSON.
                    // Sometimes (unfortunately) our APIs declare their Content-Type as JSON, however they return an empty body.
                    if (response.headers.get('Content-Length') === '0') {
                        console.warn(`${response.url} returned an invalid JSON`);
                        return {};
                    }
                    return yield response.json();
                case 'text':
                    return response.text();
            }
        }
        const textData = yield response.text(); // this could be just a string, prometheus requests for instance
        try {
            return JSON.parse(textData); // majority of the requests this will be something that can be parsed
        }
        catch (_a) { }
        return textData;
    });
}
export function serializeParams(data) {
    return Object.keys(data)
        .map((key) => {
        const value = data[key];
        if (Array.isArray(value)) {
            return value.map((arrayValue) => `${encodeURIComponent(key)}=${encodeURIComponent(arrayValue)}`).join('&');
        }
        return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
    })
        .join('&');
}
export const parseUrlFromOptions = (options) => {
    const cleanParams = omitBy(options.params, (v) => v === undefined || (v && v.length === 0));
    const serializedParams = serializeParams(cleanParams);
    return options.params && serializedParams.length ? `${options.url}?${serializedParams}` : options.url;
};
export const parseCredentials = (options) => {
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