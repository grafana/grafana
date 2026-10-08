import { classifyPage, pageKey } from './classifyPage';

describe('classifyPage', () => {
  it.each([
    ['/d/abc', { kind: 'dashboard', uid: 'abc', pathname: '/d/abc' }],
    ['/d/abc/some-slug', { kind: 'dashboard', uid: 'abc', pathname: '/d/abc/some-slug' }],
    ['/d/abc/', { kind: 'dashboard', uid: 'abc', pathname: '/d/abc' }],
    ['/explore', { kind: 'explore', pathname: '/explore' }],
    ['/explore/', { kind: 'explore', pathname: '/explore' }],
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
    expect(pageKey(classifyPage('/alerting/list/')!)).toBe(pageKey(classifyPage('/alerting/list')!));
  });

  it('keeps different pages apart', () => {
    const keys = ['/d/abc', '/d/xyz', '/explore', '/alerting/list', '/alerting/silences', '/a/x/y'].map((p) =>
      pageKey(classifyPage(p)!)
    );
    expect(new Set(keys).size).toBe(keys.length);
  });
});
