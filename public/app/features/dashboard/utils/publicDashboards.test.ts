import { describe } from '../../../../test/lib/common';

import { isDashboardPubliclyViewed } from './publicDashboards';

describe('public dashboard utils', () => {
  it('returns true for public url', () => {
    window.history.pushState({}, 'Test Title', '/p/abc/123');
    expect(isDashboardPubliclyViewed()).toBeTruthy();
  });
  it('returns false for dashboard url', () => {
    window.history.pushState({}, 'Test Title', '/d/abc/123');
    expect(isDashboardPubliclyViewed()).toBeFalsy();
  });
});
