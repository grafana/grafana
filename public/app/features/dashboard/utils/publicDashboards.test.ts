import { describe } from '../../../../test/lib/common';

import { isPublicDashboardView } from './publicDashboards';

describe('public dashboard utils', () => {
  it('returns true for public url', () => {
    window.history.pushState({}, 'Test Title', '/p/abc/123');
    expect(isPublicDashboardView()).toBeTruthy();
  });
  it('returns false for dashboard url', () => {
    window.history.pushState({}, 'Test Title', '/d/abc/123');
    expect(isPublicDashboardView()).toBeFalsy();
  });
});
