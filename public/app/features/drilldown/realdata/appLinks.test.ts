import { locationService } from '@grafana/runtime';

import { appServiceUrl } from './appLinks';

const open = (...args: Parameters<typeof appServiceUrl>) => {
  const url = appServiceUrl(...args);
  return url === undefined ? undefined : new URL(url, 'http://grafana.test');
};

beforeEach(() => {
  locationService.replace(
    '/drilldown?var-ds-logs=loki-uid&var-ds-metrics=prom-uid&var-ds-traces=tempo-uid&var-ds-profiles=pyro-uid'
  );
});

describe('appServiceUrl', () => {
  it('opens Logs Drilldown on the service, with the service as a label filter', () => {
    const url = open('logs', '/a/grafana-lokiexplore-app/explore', 'checkout');

    expect(url?.pathname).toBe('/a/grafana-lokiexplore-app/explore/service/checkout/logs');
    expect(Object.fromEntries(url!.searchParams)).toEqual({
      'var-ds': 'loki-uid',
      from: 'now-30m',
      to: 'now',
      'var-filters': 'service_name|=|checkout,checkout',
    });
  });

  it('turns a slash or a backslash in the name into a dash and encodes the rest for the Logs Drilldown path', () => {
    expect(open('logs', '/a/grafana-lokiexplore-app/explore', 'shop/front end\\v2')?.pathname).toBe(
      '/a/grafana-lokiexplore-app/explore/service/shop-front%20end-v2/logs'
    );
  });

  it('opens Metrics Drilldown on the metrics of the service', () => {
    const url = open('metrics', '/a/grafana-metricsdrilldown-app/drilldown', 'checkout');

    expect(url?.pathname).toBe('/a/grafana-metricsdrilldown-app/drilldown');
    expect(Object.fromEntries(url!.searchParams)).toEqual({
      'var-ds': 'prom-uid',
      from: 'now-30m',
      to: 'now',
      'var-filters': 'service_name|=|checkout',
    });
  });

  it('filters Metrics Drilldown on the label the span metrics put the service in', () => {
    const url = open('metrics', '/a/grafana-metricsdrilldown-app/drilldown', 'checkout', 'service');

    expect(url?.searchParams.get('var-filters')).toBe('service|=|checkout');
  });

  it('opens Traces Drilldown on the traces of the service', () => {
    const url = open('traces', '/a/grafana-exploretraces-app/explore', 'checkout');

    expect(url?.pathname).toBe('/a/grafana-exploretraces-app/explore');
    expect(Object.fromEntries(url!.searchParams)).toEqual({
      'var-ds': 'tempo-uid',
      from: 'now-30m',
      to: 'now',
      'var-primarySignal': 'true',
      'var-filters': 'resource.service.name|=|checkout',
    });
  });

  it('opens Profiles Drilldown on the CPU profile of the service', () => {
    const url = open('profiles', '/a/grafana-pyroscope-app/explore', 'checkout');

    expect(url?.pathname).toBe('/a/grafana-pyroscope-app/explore');
    expect(Object.fromEntries(url!.searchParams)).toEqual({
      'var-dataSource': 'pyro-uid',
      'var-serviceName': 'checkout',
      'var-profileMetricId': 'process_cpu:cpu:nanoseconds:cpu:nanoseconds',
      explorationType: 'labels',
      from: 'now-30m',
      to: 'now',
    });
  });

  it('keeps the sub path Grafana runs under', () => {
    expect(open('traces', '/grafana/a/grafana-exploretraces-app/explore', 'checkout')?.pathname).toBe(
      '/grafana/a/grafana-exploretraces-app/explore'
    );
  });

  it('leaves the data source out when none is chosen for the signal', () => {
    locationService.replace('/drilldown');

    expect(open('metrics', '/a/grafana-metricsdrilldown-app/drilldown', 'checkout')?.searchParams.has('var-ds')).toBe(
      false
    );
  });

  it.each([
    { case: 'the app is not in the nav', app: 'logs' as const, navUrl: undefined },
    { case: 'the nav URL is not an app URL', app: 'logs' as const, navUrl: '/explore' },
    { case: 'the signal is SQL, which has no chart', app: 'sql' as const, navUrl: '/a/some-sql-app/explore' },
  ])('gives no link when $case', ({ app, navUrl }) => {
    expect(appServiceUrl(app, navUrl, 'checkout')).toBeUndefined();
  });
});
