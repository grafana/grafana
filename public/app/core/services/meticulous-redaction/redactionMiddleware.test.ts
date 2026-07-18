import { type HarResponse } from '@alwaysmeticulous/api';
import { type NetworkResponseMetadata } from '@alwaysmeticulous/sdk-bundles-api';

import { createQueryRedactionMiddleware, QUERY_URL_REGEX } from './redactionMiddleware';

function harResponse(text: string): HarResponse {
  return {
    status: 200,
    headers: [],
    content: { mimeType: 'application/json', text },
  };
}

function metadata(url: string, postDataText?: string): NetworkResponseMetadata {
  return {
    requestStartedAt: 0,
    responseReceivedAt: 1,
    request: {
      method: 'POST',
      url,
      headers: [],
      ...(postDataText != null && { postData: { mimeType: 'application/json', text: postDataText } }),
    },
  };
}

const QUERY_URL = 'https://grafana.example.com/api/ds/query?ds_type=prometheus';

describe('QUERY_URL_REGEX', () => {
  it.each([
    ['https://grafana.example.com/api/ds/query?ds_type=prometheus', true],
    ['https://grafana.example.com/api/ds/query', true],
    ['https://grafana.example.com/apis/query.grafana.app/v0alpha1/namespaces/default/query?ds_type=loki', true],
    ['https://grafana.example.com/api/dashboards/uid/abc', false],
    ['https://grafana.example.com/api/datasources', false],
  ])('%s -> %s', (url, expected) => {
    expect(QUERY_URL_REGEX.test(url)).toBe(expected);
  });
});

describe('createQueryRedactionMiddleware', () => {
  const middleware = createQueryRedactionMiddleware();

  it('returns the same response reference for non-query URLs', () => {
    const response = harResponse(JSON.stringify({ secret: 'value' }));
    const output = middleware.transformNetworkResponse!(
      response,
      metadata('https://grafana.example.com/api/dashboards/uid/abc')
    );
    expect(output).toBe(response);
  });

  it('redacts query responses using the request body for exemptions', () => {
    const body = JSON.stringify({
      results: {
        A: {
          frames: [{ schema: { refId: 'A', fields: [{ name: 'v', type: 'string' }] }, data: { values: [['secret']] } }],
        },
      },
    });
    const postData = JSON.stringify({ queries: [{ refId: 'A', datasource: { type: 'prometheus' } }] });

    const output = middleware.transformNetworkResponse!(harResponse(body), metadata(QUERY_URL, postData));
    const parsed = JSON.parse(output.content.text!);
    expect(parsed.results.A.frames[0].data.values[0][0]).not.toBe('secret');
    expect(parsed.results.A.frames[0].data.values[0][0]).toHaveLength('secret'.length);
  });

  it('replaces non-JSON bodies on query URLs', () => {
    const output = middleware.transformNetworkResponse!(harResponse('<html>error</html>'), metadata(QUERY_URL));
    expect(output.content.text).toBe('<REDACTED>');
  });

  it('drops websocket data', () => {
    const connection = { url: 'wss://grafana.example.com/api/live/ws', messages: [] };
    expect(middleware.transformWebSocketConnectionData!(connection as never)).toBeNull();
  });
});
