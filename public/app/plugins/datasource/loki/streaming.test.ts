import { convertToWebSocketUrl } from './streaming';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  config: {
    appSubUrl: '/grafana',
  },
}));

describe('convertToWebSocketUrl', () => {
  const win: typeof globalThis = window;
  const { location } = win;

  beforeEach(() => {
    // @ts-ignore
    delete win.location;
    win.location = {} as Location;
  });

  afterEach(() => {
    win.location = location;
  });
  it('should convert HTTP URL to WebSocket URL', () => {
    win.location.protocol = 'http:';
    win.location.host = 'example.com';

    const httpUrl = '/api/ds/proxy/1/api/v1/tail/loki?query=a';
    const expectedWebSocketUrl = 'ws://example.com/grafana/api/ds/proxy/1/api/v1/tail/loki?query=a';

    const result = convertToWebSocketUrl(httpUrl);

    expect(result).toBe(expectedWebSocketUrl);
  });

  it('should convert HTTPS URL to WebSocket URL', () => {
    win.location.protocol = 'https:';
    win.location.host = 'example.com';

    const httpsUrl = '/api/ds/proxy/1/api/v1/tail/loki?query=a';
    const expectedWebSocketUrl = 'wss://example.com/grafana/api/ds/proxy/1/api/v1/tail/loki?query=a';

    const result = convertToWebSocketUrl(httpsUrl);

    expect(result).toBe(expectedWebSocketUrl);
  });
});
