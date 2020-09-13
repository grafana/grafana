import { BackendSrvRequest } from '@grafana/runtime';
import omitBy from 'lodash/omitBy';
import { deprecationWarning } from '@grafana/data';

export const parseInitFromOptions = (options: BackendSrvRequest): RequestInit => {
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

interface HeaderParser {
  canParse: (options: BackendSrvRequest) => boolean;
  parse: (headers: Headers) => Headers;
}

const defaultHeaderParser: HeaderParser = {
  canParse: () => true,
  parse: headers => {
    const accept = headers.get('accept');
    if (accept) {
      return headers;
    }

    headers.set('accept', 'application/json, text/plain, */*');
    return headers;
  },
};

const parseHeaderByMethodFactory = (methodPredicate: string): HeaderParser => ({
  canParse: options => {
    const method = options?.method ? options?.method.toLowerCase() : '';
    return method === methodPredicate;
  },
  parse: headers => {
    const contentType = headers.get('content-type');
    if (contentType) {
      return headers;
    }

    headers.set('content-type', 'application/json');
    return headers;
  },
});

const postHeaderParser: HeaderParser = parseHeaderByMethodFactory('post');
const putHeaderParser: HeaderParser = parseHeaderByMethodFactory('put');

const headerParsers = [postHeaderParser, putHeaderParser, defaultHeaderParser];

export const parseHeaders = (options: BackendSrvRequest) => {
  const headers = options?.headers ? new Headers(options.headers) : new Headers();
  const parsers = headerParsers.filter(parser => parser.canParse(options));
  const combinedHeaders = parsers.reduce((prev, parser) => {
    return parser.parse(prev);
  }, headers);

  return combinedHeaders;
};

export const isContentTypeApplicationJson = (headers: Headers) => {
  if (!headers) {
    return false;
  }

  const contentType = headers.get('content-type');
  if (contentType && contentType.toLowerCase() === 'application/json') {
    return true;
  }

  return false;
};

export const parseBody = (options: BackendSrvRequest, isAppJson: boolean) => {
  if (!options) {
    return options;
  }

  if (!options.data || typeof options.data === 'string') {
    return options.data;
  }

  return isAppJson ? JSON.stringify(options.data) : new URLSearchParams(options.data);
};

export function serializeParams(data: Record<string, any>): string {
  return Object.keys(data)
    .map(key => {
      const value = data[key];
      if (Array.isArray(value)) {
        return value.map(arrayValue => `${encodeURIComponent(key)}=${encodeURIComponent(arrayValue)}`).join('&');
      }
      return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
    })
    .join('&');
}

export const parseUrlFromOptions = (options: BackendSrvRequest): string => {
  const cleanParams = omitBy(options.params, v => v === undefined || (v && v.length === 0));
  const serializedParams = serializeParams(cleanParams);
  return options.params && serializedParams.length ? `${options.url}?${serializedParams}` : options.url;
};

export const parseCredentials = (options: BackendSrvRequest): RequestCredentials => {
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
