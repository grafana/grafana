import { type GrafanaConfig, locationUtil } from '@grafana/data';
import { locationService } from '@grafana/runtime';

import { contextSrv, RedirectToUrlKey } from '../services/context_srv';

import { handleRedirectTo } from './handleRedirectTo';

describe('handleRedirectTo', () => {
  // These tests replace shared globals and singleton methods, so keep the originals to restore test isolation.
  const originalLocation = window.location;
  const originalReplace = locationService.replace;
  const originalGetSearch = locationService.getSearch;
  const originalIsSignedIn = contextSrv.user.isSignedIn;
  const originalOrgId = contextSrv.user.orgId;
  const originalCanParse = URL.canParse;

  beforeEach(() => {
    sessionStorage.clear();

    locationUtil.initialize({
      config: { appSubUrl: '/grafana' } as GrafanaConfig,
      getVariablesUrlParams: jest.fn(),
      getTimeRangeForUrl: jest.fn(),
    });

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        origin: 'http://grafana.local',
        pathname: '/',
        replace: jest.fn(),
      },
    });

    const mockLocationService = locationService as jest.Mocked<typeof locationService>;
    mockLocationService.replace = jest.fn();
    mockLocationService.getSearch = jest.fn().mockReturnValue(new URLSearchParams());

    // JSDOM in this test environment does not provide URL.canParse(), but the production code uses it.
    // Mirror the browser behavior so these tests exercise the real same-origin/orgId branch.
    URL.canParse = (url, base) => {
      try {
        new URL(url, base);
        return true;
      } catch {
        return false;
      }
    };

    contextSrv.user.isSignedIn = false;
    contextSrv.user.orgId = 1;
  });

  afterEach(() => {
    locationService.replace = originalReplace;
    locationService.getSearch = originalGetSearch;
    contextSrv.user.isSignedIn = originalIsSignedIn;
    contextSrv.user.orgId = originalOrgId;
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
    URL.canParse = originalCanParse;
    jest.restoreAllMocks();
  });

  it('does not hard redirect cross-origin URLs even when orgId changes', () => {
    contextSrv.user.isSignedIn = true;
    contextSrv.user.orgId = 1;
    sessionStorage.setItem(RedirectToUrlKey, encodeURIComponent('https://evil.com/d/test?orgId=2'));

    handleRedirectTo();

    expect(window.location.replace).not.toHaveBeenCalled();
    expect(locationService.replace).toHaveBeenCalledWith('https://evil.com/d/test?orgId=2');
  });

  it('hard redirects same-origin URLs that switch orgs', () => {
    contextSrv.user.isSignedIn = true;
    contextSrv.user.orgId = 1;
    sessionStorage.setItem(RedirectToUrlKey, encodeURIComponent('/grafana/d/test?orgId=2'));

    handleRedirectTo();

    expect(window.location.replace).toHaveBeenCalledWith('/grafana/d/test?orgId=2');
    expect(locationService.replace).not.toHaveBeenCalled();
  });

  it('falls back to frontend navigation for same-origin redirects in the current org', () => {
    contextSrv.user.isSignedIn = true;
    contextSrv.user.orgId = 1;
    sessionStorage.setItem(RedirectToUrlKey, encodeURIComponent('/grafana/d/test?orgId=1'));

    handleRedirectTo();

    expect(window.location.replace).not.toHaveBeenCalled();
    expect(locationService.replace).toHaveBeenCalledWith('/d/test?orgId=1');
  });
});
