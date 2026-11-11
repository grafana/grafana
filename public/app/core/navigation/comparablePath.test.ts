import { toComparablePath } from './comparablePath';

describe('toComparablePath', () => {
  it.each([
    ['returns the pathname unchanged when there is nothing to normalize', '/explore', undefined, '/explore'],
    ['strips a query string', '/dashboards/d/abc?editview=panels', undefined, '/dashboards/d/abc'],
    ['strips a hash fragment', '/foo#bar', undefined, '/foo'],
    ['strips a trailing slash', '/explore/', undefined, '/explore'],
    ['preserves the root pathname as "/"', '/', undefined, '/'],
    ['collapses multiple trailing slashes to a single root', '///', undefined, '/'],
    ['strips the appSubUrl prefix when present', '/grafana/explore', '/grafana', '/explore'],
    ['leaves the pathname alone when the appSubUrl prefix is not present', '/explore', '/grafana', '/explore'],
    ['tolerates a trailing slash on the appSubUrl', '/grafana/explore', '/grafana/', '/explore'],
    ['treats an empty appSubUrl as the default', '/explore', '', '/explore'],
    [
      'applies all normalizations together: prefix, query, trailing slash',
      '/grafana/dashboards/snapshots/?tab=1',
      '/grafana',
      '/dashboards/snapshots',
    ],
  ])('%s', (_, url, appSubUrl, expected) => {
    expect(toComparablePath(url, appSubUrl)).toBe(expected);
  });
});
