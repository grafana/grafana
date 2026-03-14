import { Location } from 'history';

import { GrafanaConfig } from '../types/config';

import { locationUtil } from './location';

describe('locationUtil', () => {
  const win: typeof globalThis = window;
  const { location } = win;

  beforeEach(() => {
    // @ts-ignore
    delete win.location;

    win.location = {
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

  afterEach(() => {
    win.location = location;
  });

  describe('stripBaseFromUrl', () => {
    describe('when appSubUrl configured', () => {
      beforeEach(() => {
        locationUtil.initialize({
          config: { appSubUrl: '/subUrl' } as GrafanaConfig,
          getVariablesUrlParams: jest.fn(),
          getTimeRangeForUrl: jest.fn(),
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
      test('relative url with similar suburl', () => {
        const urlWithoutMaster = locationUtil.stripBaseFromUrl('/subUrl-backup/thisShouldRemain/');
        expect(urlWithoutMaster).toBe('/subUrl-backup/thisShouldRemain/');
      });
      test('relative url with same url', () => {
        const urlWithoutMaster = locationUtil.stripBaseFromUrl('/subUrl');
        expect(urlWithoutMaster).toBe('');
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
        expect(urlWithoutMaster).toBe('http://www.domain.com:9877/thisShouldRemain/subUrl/');
      });
      test('absolute url with similar suburl', () => {
        const urlWithoutMaster = locationUtil.stripBaseFromUrl(
          'http://www.domain.com:9877/subUrl-backup/thisShouldRemain/'
        );
        expect(urlWithoutMaster).toBe('http://www.domain.com:9877/subUrl-backup/thisShouldRemain/');
      });
      test('absolute url with same url', () => {
        const urlWithoutMaster = locationUtil.stripBaseFromUrl('http://www.domain.com:9877/subUrl');
        expect(urlWithoutMaster).toBe('');
      });
    });

    describe('when appSubUrl not configured', () => {
      beforeEach(() => {
        locationUtil.initialize({
          config: {} as GrafanaConfig,
          getVariablesUrlParams: jest.fn(),
          getTimeRangeForUrl: jest.fn(),
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

    describe('when origin does not have a port in it', () => {
      beforeEach(() => {
        win.location = {
          ...location,
          hash: '#hash',
          host: 'www.domain.com',
          hostname: 'www.domain.com',
          href: 'http://www.domain.com/path/b?search=a&b=c&d#hash',
          origin: 'http://www.domain.com',
          pathname: '/path/b',
          port: '',
          protocol: 'http:',
          search: '?search=a&b=c&d',
        };
      });

      test('relative url', () => {
        const urlWithoutMaster = locationUtil.stripBaseFromUrl('/subUrl/grafana/');
        expect(urlWithoutMaster).toBe('/subUrl/grafana/');
      });

      test('URL with same host, different port', () => {
        const urlWithoutMaster = locationUtil.stripBaseFromUrl('http://www.domain.com:9877/subUrl/grafana/');
        expect(urlWithoutMaster).toBe('http://www.domain.com:9877/subUrl/grafana/');
      });

      test('URL of a completely different origin', () => {
        const urlWithoutMaster = locationUtil.stripBaseFromUrl('http://www.another-domain.com/subUrl/grafana/');
        expect(urlWithoutMaster).toBe('http://www.another-domain.com/subUrl/grafana/');
      });
    });
  });

  describe('getUrlForPartial', () => {
    const mockLocation: Location = {
      hash: '',
      pathname: '/',
      search: '',
      state: {},
    };
    describe('when appSubUrl is not configured', () => {
      beforeEach(() => {
        locationUtil.initialize({
          config: {
            appSubUrl: '',
          } as GrafanaConfig,
          getVariablesUrlParams: jest.fn(),
          getTimeRangeForUrl: jest.fn(),
        });
      });

      it('can add params', () => {
        expect(locationUtil.getUrlForPartial(mockLocation, { forceLogin: 'true' })).toEqual('/?forceLogin=true');
      });

      it('can remove params using undefined', () => {
        expect(
          locationUtil.getUrlForPartial(
            {
              ...mockLocation,
              search: '?a=1',
            },
            { a: undefined }
          )
        ).toEqual('/');
      });

      it('can remove params using null', () => {
        expect(
          locationUtil.getUrlForPartial(
            {
              ...mockLocation,
              search: '?a=1',
            },
            { a: null }
          )
        ).toEqual('/');
      });
    });

    describe('when appSubUrl is configured', () => {
      beforeEach(() => {
        locationUtil.initialize({
          config: {
            appSubUrl: '/subpath',
          } as GrafanaConfig,
          getVariablesUrlParams: jest.fn(),
          getTimeRangeForUrl: jest.fn(),
        });
      });

      it('can add params', () => {
        expect(locationUtil.getUrlForPartial(mockLocation, { forceLogin: 'true' })).toEqual(
          '/subpath/?forceLogin=true'
        );
      });

      it('can remove params using undefined', () => {
        expect(
          locationUtil.getUrlForPartial(
            {
              ...mockLocation,
              search: '?a=1',
            },
            { a: undefined }
          )
        ).toEqual('/subpath/');
      });

      it('can remove params using null', () => {
        expect(
          locationUtil.getUrlForPartial(
            {
              ...mockLocation,
              search: '?a=1',
            },
            { a: null }
          )
        ).toEqual('/subpath/');
      });
    });
  });

  describe('updateSearchParams', () => {
    beforeEach(() => {
      locationUtil.initialize({
        config: {} as GrafanaConfig,
        getVariablesUrlParams: jest.fn(),
        getTimeRangeForUrl: jest.fn(),
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

  describe('processRedirectUri', () => {
    const mockLocation: Location = {
      hash: '',
      pathname: '/',
      search: '',
      state: {},
    };

    beforeEach(() => {
      locationUtil.initialize({
        config: {} as GrafanaConfig,
        getVariablesUrlParams: jest.fn(),
        getTimeRangeForUrl: jest.fn(),
      });
    });

    test('merges current params with redirect URI params', () => {
      const redirectUri = '/a/custom-home-plugin?tab=recent';
      const currentLocation = { ...mockLocation, search: '?doc=some-query-value' };
      const result = locationUtil.processRedirectUri(redirectUri, currentLocation);
      expect(result).toBe('/a/custom-home-plugin?tab=recent&doc=some-query-value');
    });

    test('redirect URI params take precedence over current params', () => {
      const redirectUri = '/d/home-dashboard?from=now-1h';
      const currentLocation = { ...mockLocation, search: '?from=now-6h&to=now' };
      const result = locationUtil.processRedirectUri(redirectUri, currentLocation);
      expect(result).toBe('/d/home-dashboard?from=now-1h&to=now');
    });

    test('handles redirect URI without query params', () => {
      const redirectUri = '/d/home-dashboard';
      const currentLocation = { ...mockLocation, search: '?from=now-6h&to=now' };
      const result = locationUtil.processRedirectUri(redirectUri, currentLocation);
      expect(result).toBe('/d/home-dashboard?from=now-6h&to=now');
    });

    test('handles empty current params', () => {
      const redirectUri = '/a/custom-home-plugin?tab=overview';
      const currentLocation = { ...mockLocation, search: '' };
      const result = locationUtil.processRedirectUri(redirectUri, currentLocation);
      expect(result).toBe('/a/custom-home-plugin?tab=overview');
    });

    test('handles both empty params', () => {
      const redirectUri = '/a/custom-home-plugin';
      const currentLocation = { ...mockLocation, search: '' };
      const result = locationUtil.processRedirectUri(redirectUri, currentLocation);
      expect(result).toBe('/a/custom-home-plugin');
    });

    test('current params can have multiple values set', () => {
      const redirectUri = '/a/custom-home-plugin';
      const currentLocation = { ...mockLocation, search: '?tab=recent&tab=starred' };
      const result = locationUtil.processRedirectUri(redirectUri, currentLocation);
      expect(result).toBe('/a/custom-home-plugin?tab=recent&tab=starred');
    });

    test('redirect URI params can have multiple values set', () => {
      const redirectUri = '/a/custom-home-plugin?tab=recent&tab=starred';
      const currentLocation = { ...mockLocation, search: '?tab=overview' };
      const result = locationUtil.processRedirectUri(redirectUri, currentLocation);
      expect(result).toBe('/a/custom-home-plugin?tab=recent&tab=starred');
    });

    test('redirect URI can be an absolute URL', () => {
      const redirectUri = 'http://www.domain.com:1234/a/custom-home-plugin?tab=recent';
      const currentLocation = { ...mockLocation, search: '?doc=some-query-value' };
      const result = locationUtil.processRedirectUri(redirectUri, currentLocation);
      expect(result).toBe('http://www.domain.com:1234/a/custom-home-plugin?tab=recent&doc=some-query-value');
    });

    describe('with appSubUrl configured', () => {
      beforeEach(() => {
        locationUtil.initialize({
          config: { appSubUrl: '/grafana' } as GrafanaConfig,
          getVariablesUrlParams: jest.fn(),
          getTimeRangeForUrl: jest.fn(),
        });
      });

      test('strips base from redirect URI', () => {
        const redirectUri = '/grafana/a/custom-home-plugin?tab=overview';
        const currentLocation = { ...mockLocation, search: '?theme=dark' };
        const result = locationUtil.processRedirectUri(redirectUri, currentLocation);
        expect(result).toBe('/a/custom-home-plugin?tab=overview&theme=dark');
      });

      test('does not strip base from redirect URI when an absolute URL is provided', () => {
        const redirectUri = 'http://www.domain.com:1234/grafana/a/custom-home-plugin?tab=overview';
        const currentLocation = { ...mockLocation, search: '?theme=dark' };
        const result = locationUtil.processRedirectUri(redirectUri, currentLocation);
        expect(result).toBe('http://www.domain.com:1234/grafana/a/custom-home-plugin?tab=overview&theme=dark');
      });
    });
  });
});
