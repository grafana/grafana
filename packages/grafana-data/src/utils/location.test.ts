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
      const urlWithoutMaster = locationUtil.stripBaseFromUrl('/subUrl/thisShouldRemain/');
      expect(urlWithoutMaster).toBe('/thisShouldRemain/');
    });
    test('relative url with multiple subUrl in path', () => {
      const urlWithoutMaster = locationUtil.stripBaseFromUrl('/subUrl/thisShouldRemain/subUrl/');
      expect(urlWithoutMaster).toBe('/thisShouldRemain/subUrl/');
    });
    test('relative url with subdirectory subUrl', () => {
      const urlWithoutMaster = locationUtil.stripBaseFromUrl('/thisShouldRemain/subUrl/');
      expect(urlWithoutMaster).toBe('/thisShouldRemain/subUrl/');
    });
    test('absolute url', () => {
      const urlWithoutMaster = locationUtil.stripBaseFromUrl('http://www.domain.com:9877/subUrl/thisShouldRemain/');
      expect(urlWithoutMaster).toBe('/thisShouldRemain/');
    });
    test('absolute url with multiple subUrl in path', () => {
      const urlWithoutMaster = locationUtil.stripBaseFromUrl(
        'http://www.domain.com:9877/subUrl/thisShouldRemain/subUrl/'
      );
      expect(urlWithoutMaster).toBe('/thisShouldRemain/subUrl/');
    });
    test('absolute url with subdirectory subUrl', () => {
      const urlWithoutMaster = locationUtil.stripBaseFromUrl('http://www.domain.com:9877/thisShouldRemain/subUrl/');
      expect(urlWithoutMaster).toBe('/thisShouldRemain/subUrl/');
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

  describe('updateSearchParams', () => {
    beforeEach(() => {
      locationUtil.initialize({
        config: {} as any,
        getVariablesUrlParams: (() => {}) as any,
        getTimeRangeForUrl: (() => {}) as any,
      });
    });

    test('absolute url', () => {
      const newURL = locationUtil.updateSearchParams(
        'http://www.domain.com:1234/test?a=1&b=2#hashtag',
        '?a=newValue&newKey=hello'
      );
      expect(newURL).toBe('http://www.domain.com:1234/test?a=newValue&b=2&newKey=hello#hashtag');
    });
  });
});
