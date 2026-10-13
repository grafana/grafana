import { setTestFlags } from '@grafana/test-utils/unstable';

import { getLifecycleBreadcrumbLabel } from './lifecycle';

const draft = { 'grafana.app/lifecycle': 'draft' };

describe('getLifecycleBreadcrumbLabel', () => {
  afterEach(() => {
    setTestFlags({});
  });

  it('labels a draft when drafts are enabled', () => {
    setTestFlags({ 'dashboard.drafts': true });

    expect(getLifecycleBreadcrumbLabel(draft)).toBe('Draft');
  });

  it('shows nothing for a draft when drafts are disabled, like the banner', () => {
    setTestFlags({ 'dashboard.drafts': false });

    expect(getLifecycleBreadcrumbLabel(draft)).toBeUndefined();
  });

  it('labels a pending changes preview', () => {
    expect(getLifecycleBreadcrumbLabel(undefined, true)).toBe('Pending changes');
  });

  it('shows nothing for a published dashboard', () => {
    expect(getLifecycleBreadcrumbLabel(undefined)).toBeUndefined();
  });
});
