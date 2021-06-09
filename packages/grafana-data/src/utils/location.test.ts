import { locationUtil } from './location';

describe('locationUtil', () => {
  const { location } = window;

  beforeAll(() => {
    // @ts-ignore
    delete window.location;

    window.location = {
      ...location,
      hash: '#hash',
      host: 'www.domain.com:9877',
      hostname: 'www.domain.com',
      href: 'http://www.domain.com:9877/path/b?search=a&b=c&d#hash',
      origin: 'http://www.domain.com:9877',
      pathname: '/path/b',
      port: '9877',
      protocol: 'http:',
      search: '?search=a&b=c&d',
    };
  });

  afterAll(() => {
    window.location = location;
  });

  describe('strip base when appSubUrl configured', () => {
    beforeEach(() => {
      locationUtil.initialize({
        config: { appSubUrl: '/subUrl' } as any,
        getVariablesUrlParams: (() => {}) as any,
        getTimeRangeForUrl: (() => {}) as any,
      });
    });
    test('relative url', () => {
      const urlWithoutMaster = locationUtil.stripBaseFromUrl('/subUrl/grafana/');
      expect(urlWithoutMaster).toBe('/grafana/');
    });
    test('absolute url url', () => {
      const urlWithoutMaster = locationUtil.stripBaseFromUrl('http://www.domain.com:9877/subUrl/grafana/');
      expect(urlWithoutMaster).toBe('/grafana/');
    });
  });

  describe('strip base when appSubUrl not configured', () => {
    beforeEach(() => {
      locationUtil.initialize({
        config: {} as any,
        getVariablesUrlParams: (() => {}) as any,
        getTimeRangeForUrl: (() => {}) as any,
      });
    });

    test('relative url', () => {
      const urlWithoutMaster = locationUtil.stripBaseFromUrl('/subUrl/grafana/');
      expect(urlWithoutMaster).toBe('/subUrl/grafana/');
    });

    test('absolute url', () => {
      const urlWithoutMaster = locationUtil.stripBaseFromUrl('http://www.domain.com:9877/subUrl/grafana/');
      expect(urlWithoutMaster).toBe('/subUrl/grafana/');
    });
  });
});
