import { type GrafanaConfig, locationUtil } from '@grafana/data';
import { locationService } from '@grafana/runtime';

import { contextSrv } from '../services/context_srv';

import { navigateToHref, navigateToOneClickLink } from './navigateToHref';

describe('navigateToHref', () => {
  const originalLocation = window.location;
  const originalPush = locationService.push;
  const originalOpen = window.open;
  const originalOrgId = contextSrv.user.orgId;

  let pushMock: jest.Mock;
  let openMock: jest.Mock;
  let setHref: jest.Mock;
  let setHash: jest.Mock;

  beforeEach(() => {
    locationUtil.initialize({
      config: { appSubUrl: '/grafana' } as GrafanaConfig,
      getVariablesUrlParams: jest.fn(),
      getTimeRangeForUrl: jest.fn(),
    });

    pushMock = jest.fn();
    locationService.push = pushMock;

    openMock = jest.fn();
    window.open = openMock;

    setHref = jest.fn();
    setHash = jest.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        origin: 'http://grafana.local',
        pathname: '/',
        set href(value: string) {
          setHref(value);
        },
        get href() {
          return '';
        },
        set hash(value: string) {
          setHash(value);
        },
        get hash() {
          return '';
        },
      },
    });

    contextSrv.user.orgId = 1;
  });

  afterEach(() => {
    locationService.push = originalPush;
    window.open = originalOpen;
    contextSrv.user.orgId = originalOrgId;
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
    jest.restoreAllMocks();
  });

  it('uses locationService.push for an internal absolute path', () => {
    navigateToHref('/d/abc?var-foo=bar');

    expect(pushMock).toHaveBeenCalledWith('/d/abc?var-foo=bar');
    expect(openMock).not.toHaveBeenCalled();
    expect(setHref).not.toHaveBeenCalled();
  });

  it('strips the configured base path before pushing', () => {
    navigateToHref('/grafana/d/abc?var-foo=bar');

    expect(pushMock).toHaveBeenCalledWith('/d/abc?var-foo=bar');
  });

  it('opens a new tab when target is _blank, without touching locationService', () => {
    navigateToHref('/d/abc', '_blank');

    expect(openMock).toHaveBeenCalledWith('/d/abc', '_blank', 'noopener,noreferrer');
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('hard navigates to absolute external URLs', () => {
    navigateToHref('https://example.com/foo');

    expect(setHref).toHaveBeenCalledWith('https://example.com/foo');
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('hard navigates to mailto links', () => {
    navigateToHref('mailto:test@example.com');

    expect(setHref).toHaveBeenCalledWith('mailto:test@example.com');
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('updates window.location.hash for hash-only links', () => {
    navigateToHref('#section');

    expect(setHash).toHaveBeenCalledWith('#section');
    expect(pushMock).not.toHaveBeenCalled();
    expect(setHref).not.toHaveBeenCalled();
  });

  it('hard navigates same-origin URLs that switch orgs', () => {
    navigateToHref('/d/abc?orgId=2');

    expect(setHref).toHaveBeenCalledWith('/d/abc?orgId=2');
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('soft pushes same-origin URLs in the current org', () => {
    navigateToHref('/d/abc?orgId=1');

    expect(pushMock).toHaveBeenCalledWith('/d/abc?orgId=1');
    expect(setHref).not.toHaveBeenCalled();
  });

  it('prefixes leading slash to relative paths', () => {
    navigateToHref('foo/bar');

    expect(pushMock).toHaveBeenCalledWith('/foo/bar');
  });
});

describe('navigateToOneClickLink', () => {
  const originalPush = locationService.push;

  beforeEach(() => {
    locationUtil.initialize({
      config: { appSubUrl: '' } as GrafanaConfig,
      getVariablesUrlParams: jest.fn(),
      getTimeRangeForUrl: jest.fn(),
    });
    locationService.push = jest.fn();
  });

  afterEach(() => {
    locationService.push = originalPush;
  });

  it('forwards to navigateToHref using the LinkModel href and target', () => {
    navigateToOneClickLink({
      href: '/d/abc?var-foo=bar',
      title: 'Test',
      target: '_self',
      origin: {},
    });

    expect(locationService.push).toHaveBeenCalledWith('/d/abc?var-foo=bar');
  });
});
