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
    ['/d/abc/', { kind: 'dashboard', uid: 'abc', pathname: '/d/abc' }],
    ['/d/abc?from=now-1h&to=now', { kind: 'dashboard', uid: 'abc', pathname: '/d/abc' }],
    [`/explore${exploreSearch({ abc: { queries: [] } })}`, { kind: 'explore', session: 'abc', pathname: '/explore' }],
    // The left pane identifies the session; a split adds a pane on the right.
    [
      `/explore/${exploreSearch({ abc: {}, def: {} }, '&orgId=1')}`,
      { kind: 'explore', session: 'abc', pathname: '/explore' },
    ],
    ['/a/grafana-irm-app/incidents', { kind: 'app', pathname: '/a/grafana-irm-app/incidents' }],
    ['/a/grafana-irm-app/incidents/5987', { kind: 'app', pathname: '/a/grafana-irm-app/incidents/5987' }],
    [
      '/a/grafana-assistant-app/investigations/abc-def/',
      { kind: 'app', pathname: '/a/grafana-assistant-app/investigations/abc-def' },
    ],
    ['/a/grafana-k8s-app/navigation/cluster', { kind: 'app', pathname: '/a/grafana-k8s-app/navigation/cluster' }],
    ['/alerting/list', { kind: 'alerting', pathname: '/alerting/list' }],
    ['/alerting/list/', { kind: 'alerting', pathname: '/alerting/list' }],
    ['/alerting/grafana/abc/view', { kind: 'alerting', pathname: '/alerting/grafana/abc/view' }],
    ['/alerting', { kind: 'alerting', pathname: '/alerting' }],
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
    '/dashboards/f/abc',
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
