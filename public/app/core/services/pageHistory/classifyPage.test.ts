import { type GrafanaConfig, locationUtil, type NavModelItem } from '@grafana/data';

import { classifyPage, pageKey, recordableSearch } from './classifyPage';

/** Explore's v1 search for the given panes (left pane first), with any extra params appended. */
function exploreSearch(panes: Record<string, unknown>, extra = '') {
  return `?schemaVersion=1&panes=${encodeURIComponent(JSON.stringify(panes))}${extra}`;
}

/** Classifies a URL given as `pathname[?search]`; without a nav tree unless the test is about one. */
const classify = (url: string, navTree: NavModelItem[] = []) => {
  const [pathname, search = ''] = url.split(/(?=\?)/);
  return classifyPage(pathname, search, navTree);
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
    [
      '/a/grafana-assistant-app/pages/grafana-org-tenure-cb1e1e23764b',
      { kind: 'page', pathname: '/a/grafana-assistant-app/pages/grafana-org-tenure-cb1e1e23764b' },
    ],
    [
      '/a/grafana-assistant-app/pages/grafana-org-tenure-cb1e1e23764b/?orgId=1',
      { kind: 'page', pathname: '/a/grafana-assistant-app/pages/grafana-org-tenure-cb1e1e23764b' },
    ],
    // Another plugin's `/pages/<id>` is an ordinary app page.
    ['/a/other-app/pages/abc', { kind: 'app', pathname: '/a/other-app/pages/abc' }],
    ['/a/grafana-k8s-app/navigation/cluster', { kind: 'app', pathname: '/a/grafana-k8s-app/navigation/cluster' }],
    ['/alerting/grafana/abc/view', { kind: 'alerting', pathname: '/alerting/grafana/abc/view' }],
    ['/alerting/grafana/abc/view/', { kind: 'alerting', pathname: '/alerting/grafana/abc/view' }],
    ['/alerting/list', { kind: 'alerting', pathname: '/alerting/list' }],
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

  describe('pages with nothing to resume', () => {
    const navTree: NavModelItem[] = [
      { text: 'Alerting', url: '/alerting', children: [{ text: 'Alert rules', url: '/alerting/list' }] },
      {
        text: 'IRM',
        url: '/a/grafana-irm-app',
        children: [{ text: 'Incidents', url: '/a/grafana-irm-app/incidents' }],
      },
      { text: 'Pages', url: '/a/grafana-assistant-app/pages' },
    ];

    it.each([
      '/alerting',
      '/alerting/list',
      '/alerting/list/',
      '/alerting/list?orgId=1',
      '/alerting/list?returnTo=%2Fd%2Fabc',
      '/alerting/list?search=',
      '/a/grafana-irm-app/incidents',
      '/a/grafana-assistant-app/pages',
    ])('ignores %s: the menu opens it the same way', (url) => {
      expect(classify(url, navTree)).toBeNull();
    });

    it.each([
      '/alerting/new',
      '/alerting/new/alerting',
      '/alerting/new/alerting?returnTo=%2Falerting%2Flist',
      '/alerting/new/recording?orgId=1',
      '/alerting/silence/new',
      '/alerting/notifications/receivers/new',
      '/a/grafana-irm-app/incidents/new',
      '/a/grafana-assistant-app/pages/new',
    ])('ignores %s: a create form reopens blank', (url) => {
      expect(classify(url)).toBeNull();
    });

    it.each([
      ['/alerting/list?search=firing', { kind: 'alerting', pathname: '/alerting/list' }],
      ['/alerting/list?orgId=1&view=grouped', { kind: 'alerting', pathname: '/alerting/list' }],
      ['/a/grafana-irm-app/incidents?status=active', { kind: 'app', pathname: '/a/grafana-irm-app/incidents' }],
      ['/alerting/grafana/abc/view', { kind: 'alerting', pathname: '/alerting/grafana/abc/view' }],
      ['/a/grafana-irm-app/incidents/5987', { kind: 'app', pathname: '/a/grafana-irm-app/incidents/5987' }],
      // Prefilled from a panel: the URL carries what the form will show.
      ['/alerting/new/alerting?defaults=%7B%7D', { kind: 'alerting', pathname: '/alerting/new/alerting' }],
      // An id that happens to be "new" is not a create form.
      ['/alerting/grafana/new/view', { kind: 'alerting', pathname: '/alerting/grafana/new/view' }],
    ])('keeps %s: state in the URL, or a page the menu does not link to', (url, expected) => {
      expect(classify(url, navTree)).toEqual(expected);
    });

    it('matches nav urls that carry the app sub url', () => {
      const subUrl = (appSubUrl: string) =>
        locationUtil.initialize({
          config: { appSubUrl } as GrafanaConfig,
          getTimeRangeForUrl: jest.fn(),
          getVariablesUrlParams: jest.fn(),
        });
      subUrl('/grafana');
      try {
        const prefixed: NavModelItem[] = [{ text: 'Alert rules', url: '/grafana/alerting/list' }];
        expect(classify('/alerting/list', prefixed)).toBeNull();
        expect(classify('/alerting/list?search=firing', prefixed)).not.toBeNull();
      } finally {
        subUrl('');
      }
    });
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
