import { getUrlDataSource } from '../dataSources';

import { CPU_PROFILE_TYPE } from './labApi';
import { type AppKey } from './liveScenario';

// The charts show the last 30 minutes, so the apps open on the same window.
const RANGE = { from: 'now-30m', to: 'now' };

function withParams(path: string, entries: Array<[string, string | undefined]>) {
  const params = new URLSearchParams();
  for (const [key, value] of entries) {
    if (value !== undefined) {
      params.append(key, value);
    }
  }
  return `${path}?${params.toString()}`;
}

// The apps read a filter as key|operator|value. A name with a comma or a pipe needs the escaping Scenes applies, which
// these links leave out.
const filter = (key: string, value: string) => `${key}|=|${value}`;

type Builder = (root: string, service: string, uid?: string, serviceLabel?: string) => string;

// How each app takes a service in its URL, from the apps' own link builders at v3.2.0.
const BUILDERS: Partial<Record<AppKey, Builder>> = {
  logs: (root, service, uid) =>
    // Logs Drilldown puts the service in the path, with a slash or a backslash turned into a dash.
    withParams(`${root}/explore/service/${encodeURIComponent(service.replace(/[/\\]/g, '-'))}/logs`, [
      ['var-ds', uid],
      ['from', RANGE.from],
      ['to', RANGE.to],
      ['var-filters', `${filter('service_name', service)},${service}`],
    ]),
  metrics: (root, service, uid, serviceLabel = 'service_name') =>
    withParams(`${root}/drilldown`, [
      ['var-ds', uid],
      ['from', RANGE.from],
      ['to', RANGE.to],
      ['var-filters', filter(serviceLabel, service)],
    ]),
  traces: (root, service, uid) =>
    withParams(`${root}/explore`, [
      ['var-ds', uid],
      ['from', RANGE.from],
      ['to', RANGE.to],
      ['var-primarySignal', 'true'],
      ['var-filters', filter('resource.service.name', service)],
    ]),
  profiles: (root, service, uid) =>
    withParams(`${root}/explore`, [
      ['var-dataSource', uid],
      ['var-serviceName', service],
      ['var-profileMetricId', CPU_PROFILE_TYPE],
      ['explorationType', 'labels'],
      ['from', RANGE.from],
      ['to', RANGE.to],
    ]),
};

// The URL that opens an app on one service. The nav gives the app's root, so an app that is not installed has no link.
// The name is what the app's data source calls the service, and Metrics Drilldown filters on the label that holds it.
export function appServiceUrl(
  app: AppKey,
  navUrl: string | undefined,
  service: string,
  serviceLabel?: string
): string | undefined {
  const root = navUrl?.match(/^(.*?\/a\/[^/?#]+)/)?.[1];
  const signal = app === 'sql' ? undefined : app;
  return root && signal ? BUILDERS[app]?.(root, service, getUrlDataSource(signal), serviceLabel) : undefined;
}
