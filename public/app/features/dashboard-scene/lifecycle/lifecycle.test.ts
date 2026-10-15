import { getLifecycleBreadcrumbLabel } from './lifecycle';

describe('getLifecycleBreadcrumbLabel', () => {
  it('labels a pending changes preview', () => {
    expect(getLifecycleBreadcrumbLabel(true)).toBe('Pending changes');
  });

  it('shows nothing for the saved dashboard', () => {
    expect(getLifecycleBreadcrumbLabel(false)).toBeUndefined();
  });
});
