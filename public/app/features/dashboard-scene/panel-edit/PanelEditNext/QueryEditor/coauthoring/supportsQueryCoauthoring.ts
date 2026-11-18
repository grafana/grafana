import { type DataSourceInstanceSettings } from '@grafana/data';

const PROMETHEUS_DATASOURCE_TYPE = 'prometheus';

export function supportsQueryCoauthoring(settings?: Pick<DataSourceInstanceSettings, 'type'>): boolean {
  // The private editor contract cannot report support independently of the feature flag yet.
  // Replace this datasource-type proxy with an explicit editor capability check.
  return settings?.type === PROMETHEUS_DATASOURCE_TYPE;
}
