import { resolveAppFromLink } from './LogLineDetailsFields';

describe('resolveAppFromLink', () => {
  it.each([
    ['https://slug.grafana.net/a/grafana-app-observability-app/', 'grafana-app-observability-app'],
    ['https://slug.grafana.net/a/grafana-kowalski-app/', 'grafana-kowalski-app'],
    ['https://slug.grafana.net/a/grafana-k8s-app/', 'grafana-k8s-app'],
    ['https://slug.grafana.net/a/grafana-dbo11y-app/', 'grafana-dbo11y-app'],
  ])('resolves the app name from %s', (href, expected) => {
    expect(resolveAppFromLink(href)).toBe(expected);
  });

  it('resolves the app name with a deeper path and query params', () => {
    expect(resolveAppFromLink('https://foo/a/grafana-k8s-app/some/deep/path?x=1#hash')).toBe('grafana-k8s-app');
  });

  it('returns undefined when there is no /a/ segment', () => {
    expect(resolveAppFromLink('https://slug.grafana.net/d/dashboard-uid/')).toBeUndefined();
  });
});
