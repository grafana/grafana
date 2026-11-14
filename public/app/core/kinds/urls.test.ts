import { config } from '@grafana/runtime';

import { CORE_KINDS } from './coreKinds';
import { kindHref, kindPath } from './urls';

describe('kindPath', () => {
  it('puts the encoded name where the kind expects it in its page path', () => {
    expect(kindPath(CORE_KINDS.connection, 'git hub/app')).toBe('/admin/provisioning/connections/git%20hub%2Fapp/edit');
  });

  it('adds a slug of the title for a kind whose page takes one', () => {
    expect(kindPath(CORE_KINDS.dashboard, 'abc', 'CPU Usage (prod)')).toBe('/d/abc/cpu-usage-prod');
  });

  it('leaves the slug out when no title is given', () => {
    expect(kindPath(CORE_KINDS.dashboard, 'abc')).toBe('/d/abc');
  });

  it('ignores the title for a kind whose page takes no slug', () => {
    expect(kindPath(CORE_KINDS.folder, 'xyz', 'My folder')).toBe('/dashboards/f/xyz');
  });

  it('has no path for a kind without a page for a single object', () => {
    expect(kindPath(CORE_KINDS.librarypanel, 'lp1')).toBeUndefined();
  });
});

describe('kindHref', () => {
  const originalAppSubUrl = config.appSubUrl;

  afterEach(() => {
    config.appSubUrl = originalAppSubUrl;
  });

  it('puts the path under the app sub path', () => {
    config.appSubUrl = '/grafana';

    expect(kindHref(CORE_KINDS.dashboard, 'abc', 'My dash')).toBe('/grafana/d/abc/my-dash');
  });

  it('has no href for a kind without a page for a single object', () => {
    config.appSubUrl = '/grafana';

    expect(kindHref(CORE_KINDS.librarypanel, 'lp1')).toBeUndefined();
  });
});
