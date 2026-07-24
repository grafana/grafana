import { transformJsonResponse } from '@alwaysmeticulous/redaction';
import { type RecorderMiddleware } from '@alwaysmeticulous/sdk-bundles-api';

import { redactQueryResponse } from './redactQueryResponse';

export const QUERY_URL_REGEX =
  /\/api\/ds\/query(\?|$)|\/apis\/query\.grafana\.app\/v0alpha1\/namespaces\/[^/]+\/query(\?|$)/;

/**
 * Recorder middleware that redacts datasource query responses before session
 * payloads are uploaded to Meticulous.
 *
 * Streaming fetch/XHR response data is dropped automatically by the recorder
 * because this middleware defines transformNetworkResponse without the
 * streaming hooks.
 */
export function createQueryRedactionMiddleware(): RecorderMiddleware {
  return {
    ...transformJsonResponse<unknown>({
      urlRegExp: QUERY_URL_REGEX,
      // fail closed: a non-JSON body on a query URL is replaced with "<REDACTED>"
      skipRedactionIfNotValidJSON: false,
      transform: (data, metadata) => redactQueryResponse(data, metadata.request.postData?.text),
    }),
    // Grafana Live / Loki live tail frames would otherwise upload unredacted
    transformWebSocketConnectionData: () => null,
  };
}
