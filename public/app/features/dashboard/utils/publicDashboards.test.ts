import { locationUtil } from '@grafana/data/src';

import { beforeEach, describe } from '../../../../test/lib/common';
import { updateConfig } from '../../../core/config';

import { isPublicDashboardView } from './publicDashboards';

beforeEach(() => {
  locationUtil.initialize({
    config: { appSubUrl: '' } as any,
    getVariablesUrlParams: (() => {}) as any,
    getTimeRangeForUrl: (() => {}) as any,
  });
});

describe('public dashboard utils', () => {
  updateConfig({
    featureToggles: { publicDashboards: true },
  });

  it('returns true for public url', () => {
    // @ts-ignore
    delete window.location;
    window.location = {
      ...window.location,
      origin: 'https://example.com',
      pathname: 'https://example.com/p/abc',
    };

    expect(isPublicDashboardView()).toBeTruthy();
  });

  it('returns true for public url when grafana is served on a subpath', () => {
    locationUtil.initialize({
      config: { appSubUrl: '/subpath' } as any,
      getVariablesUrlParams: (() => {}) as any,
      getTimeRangeForUrl: (() => {}) as any,
    });
    // @ts-ignore
    delete window.location;
    window.location = {
      ...window.location,
      origin: 'https://example.com',
      pathname: 'https://example.com/subpath/p/abc',
    };

    expect(isPublicDashboardView()).toBeTruthy();
  });

  it('returns false for dashboard url', () => {
    // @ts-ignore
    delete window.location;
    window.location = {
      ...window.location,
      origin: 'https://example.com',
      pathname: 'https://example.com/d/abc/123',
    };

    expect(isPublicDashboardView()).toBeFalsy();
  });
});
