import { convertToWebSocketUrl } from './streaming';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  config: {
    appSubUrl: '/grafana',
  },
}));

describe('convertToWebSocketUrl', () => {
  const { location } = window;

  beforeEach(() => {
    // @ts-ignore
    delete window.location;
    window.location = {} as Location;
  });

  afterEach(() => {
    window.location = location;
  });
  it('should convert HTTP URL to WebSocket URL', () => {
    window.location.protocol = 'http:';
    window.location.host = 'example.com';

    const httpUrl = '/api/ds/proxy/1/api/v1/tail/loki?query=a';
    const expectedWebSocketUrl = 'ws://example.com/grafana/api/ds/proxy/1/api/v1/tail/loki?query=a';

    const result = convertToWebSocketUrl(httpUrl);

    expect(result).toBe(expectedWebSocketUrl);
  });

  it('should convert HTTPS URL to WebSocket URL', () => {
    window.location.protocol = 'https:';
    window.location.host = 'example.com';

    const httpsUrl = '/api/ds/proxy/1/api/v1/tail/loki?query=a';
    const expectedWebSocketUrl = 'wss://example.com/grafana/api/ds/proxy/1/api/v1/tail/loki?query=a';

    const result = convertToWebSocketUrl(httpsUrl);

    expect(result).toBe(expectedWebSocketUrl);
  });
});
