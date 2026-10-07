import { classifyPage, pageKey } from './classifyPage';

describe('classifyPage', () => {
  it.each([
    ['/d/abc', { kind: 'dashboard', uid: 'abc' }],
    ['/d/abc/some-slug', { kind: 'dashboard', uid: 'abc' }],
    ['/d/abc/', { kind: 'dashboard', uid: 'abc' }],
    ['/explore', { kind: 'explore' }],
    ['/explore/', { kind: 'explore' }],
    ['/a/grafana-ml-app/investigations/123', { kind: 'investigation', pluginId: 'grafana-ml-app', id: '123' }],
    ['/a/grafana-ml-app/investigation/123', { kind: 'investigation', pluginId: 'grafana-ml-app', id: '123' }],
    [
      '/a/grafana-assistant-app/investigations/abc-def',
      { kind: 'investigation', pluginId: 'grafana-assistant-app', id: 'abc-def' },
    ],
    ['/a/grafana-ml-app/investigations/123/details', { kind: 'investigation', pluginId: 'grafana-ml-app', id: '123' }],
    ['/a/grafana-ml-app/investigations', { kind: 'app', pathname: '/a/grafana-ml-app/investigations' }],
    ['/a/other-app/investigations/123', { kind: 'app', pathname: '/a/other-app/investigations/123' }],
    ['/a/grafana-k8s-app/navigation/cluster', { kind: 'app', pathname: '/a/grafana-k8s-app/navigation/cluster' }],
    ['/alerting/list', { kind: 'alerting', pathname: '/alerting/list' }],
    ['/alerting/list/', { kind: 'alerting', pathname: '/alerting/list' }],
    ['/alerting/grafana/abc/view', { kind: 'alerting', pathname: '/alerting/grafana/abc/view' }],
    ['/alerting', { kind: 'alerting', pathname: '/alerting' }],
  ])('classifies %s', (pathname, expected) => {
    expect(classifyPage(pathname)).toEqual(expected);
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
    '/explore/metrics/trail',
    '/a',
    '/a/',
    '/connections/datasources',
    '/profile',
    '/admin/users',
  ])('ignores %s', (pathname) => {
    expect(classifyPage(pathname)).toBeNull();
  });
});

describe('pageKey', () => {
  it('folds variants of one page onto the same key', () => {
    expect(pageKey(classifyPage('/d/abc/slug')!)).toBe(pageKey(classifyPage('/d/abc')!));
    expect(pageKey(classifyPage('/a/grafana-ml-app/investigations/123/details')!)).toBe(
      pageKey(classifyPage('/a/grafana-assistant-app/investigation/123')!)
    );
  });

  it('keeps different pages apart', () => {
    const keys = ['/d/abc', '/d/xyz', '/explore', '/alerting/list', '/alerting/silences', '/a/x/y'].map((p) =>
      pageKey(classifyPage(p)!)
    );
    expect(new Set(keys).size).toBe(keys.length);
  });
});
