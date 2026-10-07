import { classifyPage } from './classifyPage';

describe('classifyPage', () => {
  it.each([
    ['/d/abc', { kind: 'dashboard', key: 'dashboard:abc' }],
    ['/d/abc/some-slug', { kind: 'dashboard', key: 'dashboard:abc' }],
    ['/d/abc/', { kind: 'dashboard', key: 'dashboard:abc' }],
    ['/explore', { kind: 'explore', key: 'explore' }],
    ['/explore/', { kind: 'explore', key: 'explore' }],
    ['/a/grafana-ml-app/investigations/123', { kind: 'investigation', key: 'investigation:123' }],
    ['/a/grafana-ml-app/investigation/123', { kind: 'investigation', key: 'investigation:123' }],
    ['/a/grafana-assistant-app/investigations/abc-def', { kind: 'investigation', key: 'investigation:abc-def' }],
    ['/a/grafana-ml-app/investigations/123/details', { kind: 'investigation', key: 'investigation:123' }],
    ['/a/grafana-ml-app/investigations', { kind: 'app', key: '/a/grafana-ml-app/investigations' }],
    ['/a/other-app/investigations/123', { kind: 'app', key: '/a/other-app/investigations/123' }],
    ['/a/grafana-k8s-app/navigation/cluster', { kind: 'app', key: '/a/grafana-k8s-app/navigation/cluster' }],
    ['/alerting/list', { kind: 'alerting', key: '/alerting/list' }],
    ['/alerting/list/', { kind: 'alerting', key: '/alerting/list' }],
    ['/alerting/grafana/abc/view', { kind: 'alerting', key: '/alerting/grafana/abc/view' }],
    ['/alerting', { kind: 'alerting', key: '/alerting' }],
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
