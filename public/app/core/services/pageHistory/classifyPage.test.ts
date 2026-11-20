import { classifyPage, pageKey, recordableSearch } from './classifyPage';

/** Explore's v1 search for the given panes (left pane first), with any extra params appended. */
function exploreSearch(panes: Record<string, unknown>, extra = '') {
  return `?schemaVersion=1&panes=${encodeURIComponent(JSON.stringify(panes))}${extra}`;
}

/** Classifies a URL given as `pathname[?search]`. */
const classify = (url: string) => {
  const [pathname, search = ''] = url.split(/(?=\?)/);
  return classifyPage(pathname, search);
};

describe('classifyPage', () => {
  it.each([
    ['/d/abc', { kind: 'dashboard', uid: 'abc', pathname: '/d/abc' }],
    ['/d/abc/some-slug', { kind: 'dashboard', uid: 'abc', pathname: '/d/abc/some-slug' }],
    // Search and a trailing slash change nothing.
    ['/d/abc/?from=now-1h&to=now', { kind: 'dashboard', uid: 'abc', pathname: '/d/abc' }],
    [`/explore${exploreSearch({ abc: { queries: [] } })}`, { kind: 'explore', session: 'abc', pathname: '/explore' }],
    // The left pane identifies the session; a split adds a pane on the right.
    [
      `/explore${exploreSearch({ abc: {}, def: {} }, '&orgId=1')}`,
      { kind: 'explore', session: 'abc', pathname: '/explore' },
    ],
    ['/a/grafana-irm-app/incidents', { kind: 'app', pathname: '/a/grafana-irm-app/incidents' }],
    ['/a/grafana-irm-app/incidents/5987', { kind: 'app', pathname: '/a/grafana-irm-app/incidents/5987' }],
    [
      '/a/grafana-assistant-app/investigations/abc-def',
      { kind: 'app', pathname: '/a/grafana-assistant-app/investigations/abc-def' },
    ],
    [
      '/a/grafana-assistant-app/pages/grafana-org-tenure-cb1e1e23764b',
      { kind: 'page', pathname: '/a/grafana-assistant-app/pages/grafana-org-tenure-cb1e1e23764b' },
    ],
    // A page whose id merely starts with "new" is still a Page; only the `new` segment is the create flow.
    [
      '/a/grafana-assistant-app/pages/newsletter-metrics-1a2b3c',
      { kind: 'page', pathname: '/a/grafana-assistant-app/pages/newsletter-metrics-1a2b3c' },
    ],
    // Another plugin's `/pages/<id>` is an ordinary app page.
    ['/a/other-app/pages/abc', { kind: 'app', pathname: '/a/other-app/pages/abc' }],
    ['/a/grafana-k8s-app/navigation/cluster', { kind: 'app', pathname: '/a/grafana-k8s-app/navigation/cluster' }],
    ['/dashboards/f/abc', { kind: 'folder', uid: 'abc', pathname: '/dashboards/f/abc' }],
    ['/dashboards/f/abc/my-folder', { kind: 'folder', uid: 'abc', pathname: '/dashboards/f/abc/my-folder' }],
    ['/notebooks/abc', { kind: 'notebook', uid: 'abc', pathname: '/notebooks/abc' }],
    // The route takes an optional slug after the uid, like dashboards do.
    ['/notebooks/abc/my-notebook', { kind: 'notebook', uid: 'abc', pathname: '/notebooks/abc/my-notebook' }],
    ['/notebooks/abc?edit=true', { kind: 'notebook', uid: 'abc', pathname: '/notebooks/abc' }],
    ['/playlists/edit/abc', { kind: 'playlist', uid: 'abc', pathname: '/playlists/edit/abc' }],
    ['/playlists/play/abc', { kind: 'playlist', uid: 'abc', pathname: '/playlists/play/abc' }],
    ['/a/grafana-workflows-app/workflows/abc', { kind: 'app', pathname: '/a/grafana-workflows-app/workflows/abc' }],
    ['/alerting', { kind: 'alerting', pathname: '/alerting' }],
    ['/alerting/list', { kind: 'alerting', pathname: '/alerting/list' }],
    ['/alerting/grafana/abc/view', { kind: 'alerting', pathname: '/alerting/grafana/abc/view' }],
    // Create forms and menu destinations are pages too; whether a visit earns a row is hasNothingToResume's call.
    ['/alerting/new/alerting', { kind: 'alerting', pathname: '/alerting/new/alerting' }],
  ])('classifies %s', (url, expected) => {
    expect(classify(url)).toEqual(expected);
  });

  it.each([
    '/',
    '/d',
    '/d/',
    '/d-solo/abc',
    '/dashboard/new',
    '/dashboard/import',
    '/dashboards',
    // Folder sub-pages, the create flows and the lists are not pages to come back to.
    '/dashboards/f/abc/my-folder/library-panels',
    '/dashboards/f/abc/my-folder/alerting',
    '/dashboards/f/abc/variables',
    '/dashboards/f',
    '/notebooks',
    '/notebooks/new',
    '/notebooks/abc/render',
    '/notebooks/abc/my-notebook/extra',
    '/playlists',
    '/playlists/new',
    '/playlists/edit',
    '/public-dashboards/abc',
    // Explore before it has written its state, in an older URL format, or with nothing to resume.
    '/explore',
    '/explore?orgId=1',
    '/explore?left=%5B%22now-1h%22%2C%22now%22%2C%22loki%22%5D',
    `/explore${exploreSearch({})}`,
    '/explore?schemaVersion=1&panes=not-json',
    '/explore?schemaVersion=1&panes=%5B%22abc%22%5D',
    '/explore/metrics/trail',
    '/a',
    '/a/',
    // The Pages list and the create flow under `new` are not pages to come back to; only existing Pages are.
    '/a/grafana-assistant-app/pages',
    '/a/grafana-assistant-app/pages/',
    '/a/grafana-assistant-app/pages?orgId=1',
    '/a/grafana-assistant-app/pages/new',
    '/a/grafana-assistant-app/pages/new/da8d0a5c-4e58-4fd4-ad0c-9bd84aad94a1',
    '/a/grafana-assistant-app/pages/new/da8d0a5c-4e58-4fd4-ad0c-9bd84aad94a1?orgId=1',
    '/connections/datasources',
    '/profile',
    '/admin/users',
  ])('ignores %s', (url) => {
    expect(classify(url)).toBeNull();
  });
});

describe('pageKey', () => {
  it('folds variants of one page onto the same key', () => {
    expect(pageKey(classify('/d/abc/slug')!)).toBe(pageKey(classify('/d/abc')!));
    expect(pageKey(classify('/notebooks/abc/slug')!)).toBe(pageKey(classify('/notebooks/abc')!));
    expect(pageKey(classify('/dashboards/f/abc/slug')!)).toBe(pageKey(classify('/dashboards/f/abc')!));
    // Editing and playing a playlist are one page.
    expect(pageKey(classify('/playlists/edit/abc')!)).toBe(pageKey(classify('/playlists/play/abc')!));
    expect(pageKey(classify('/alerting/list/')!)).toBe(pageKey(classify('/alerting/list')!));
    // Query edits and a split keep the Explore session.
    expect(pageKey(classify(`/explore${exploreSearch({ abc: { queries: ['up'] } })}`)!)).toBe(
      pageKey(classify(`/explore${exploreSearch({ abc: { queries: ['down'] }, def: {} })}`)!)
    );
  });

  it('keeps different pages apart', () => {
    const keys = [
      '/d/abc',
      '/d/xyz',
      `/explore${exploreSearch({ abc: {} })}`,
      `/explore${exploreSearch({ xyz: {} })}`,
      '/alerting/list',
      '/alerting/silences',
      '/a/x/y',
      // The same uid in different kinds is different pages.
      '/dashboards/f/abc',
      '/notebooks/abc',
      '/playlists/edit/abc',
    ].map((url) => pageKey(classify(url)!));
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('recordableSearch', () => {
  const dashboard = classify('/d/abc')!;

  it('drops the params that reopen editors, drawers and kiosk mode on dashboards', () => {
    expect(
      recordableSearch(
        dashboard,
        '?from=now-1h&to=now&editPanel=3&editview=settings&inspect=2&shareView=link&kiosk&drow=r1&viewPanel=panel-4&var-a=b'
      )
    ).toBe('?from=now-1h&to=now&viewPanel=panel-4&var-a=b');
    expect(recordableSearch(dashboard, '?editPanel=3')).toBe('');
  });

  it('keeps repeated and encoded values', () => {
    expect(recordableSearch(dashboard, '?var-host=a&var-host=b&var-q=x%20y&editPanel=1')).toBe(
      '?var-host=a&var-host=b&var-q=x+y'
    );
  });

  it('leaves other kinds untouched', () => {
    expect(recordableSearch(classify('/alerting/list')!, '?editPanel=3&search=x')).toBe('?editPanel=3&search=x');
  });
});
