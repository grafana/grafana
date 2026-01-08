import { HttpHandler, matchRequestUrl } from 'msw';
import { JsonValue } from 'type-fest';

import server from '@grafana/test-utils/server';

type PredicateFn = (request: Request) => boolean;

/**
 * Wait for the mock server to receive a request for the given method + url combination,
 * and resolve with information about the request that was made
 *
 * @deprecated Try not to use this 🙏 instead aim to assert against UI side effects
 */
export function waitForServerRequest(handler: HttpHandler) {
  const { method, path } = handler.info;
  return new Promise<Request>((resolve) => {
    server.events.on('request:match', ({ request }) => {
      const matchesMethod = request.method.toLowerCase() === String(method).toLowerCase();
      const matchesUrl = matchRequestUrl(new URL(request.url), path);

      if (matchesMethod && matchesUrl) {
        resolve(request);
      }
    });
  });
}

interface SerializedRequest {
  method: string;
  url: string;
  body: string | JsonValue;
  headers: string[][];
}

/**
 * Collect all requests seen by MSW and return them when the return promise is await-ed.
 *
 * @example
 * const capture = captureRequests();
 * // click a button, invoke a hook, etc.
 * const requests = await capture;
 *
 * @deprecated Try not to use this 🙏 instead aim to assert against UI side effects
 */

export async function captureRequests(predicateFn: PredicateFn = () => true): Promise<Request[]> {
  const requests: Request[] = [];

  server.events.on('request:start', ({ request }) => {
    if (predicateFn(request)) {
      requests.push(request);
    }
  });

  return requests;
}

const DEVICE_ID_HEADER = 'x-grafana-device-id';

export async function serializeRequest(originalRequest: Request): Promise<SerializedRequest> {
  const request = originalRequest;
  const { method, url, headers } = request;

  // omit the fingerprint ID from the request header since it is machine-specific
  headers.delete(DEVICE_ID_HEADER);

  const body = await request.json().catch(() => request.text());
  const serializedHeaders = Array.from(headers.entries());

  return {
    method,
    url,
    body,
    headers: serializedHeaders,
  };
}

export async function serializeRequests(requests: Request[]): Promise<SerializedRequest[]> {
  return Promise.all(requests.map(serializeRequest));
}
