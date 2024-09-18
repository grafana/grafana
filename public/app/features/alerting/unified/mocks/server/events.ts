import { HttpHandler, matchRequestUrl } from 'msw';

import server from 'app/features/alerting/unified/mockApi';

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
