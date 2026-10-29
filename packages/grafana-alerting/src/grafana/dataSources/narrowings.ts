import { type DataSourceInstanceListItem } from '@grafana/data';
import { config } from '@grafana/runtime';
import { type GetDataSourceInstanceListFilters, getDataSourceInstanceList } from '@grafana/runtime/unstable';

import {
  SUPPORTED_EXTERNAL_PROMETHEUS_FLAVORED_RULE_SOURCE_TYPES,
  isDataSourceManagingAlerts,
  isSupportedExternalPrometheusFlavoredRulesSourceType,
  isValidRecordingRulesTarget,
} from './predicates';

// Temporary: the list items carry no jsonData. Read it from config.datasources until Alerting has a
// dedicated backend API that returns the jsonData fields its data source checks need.
function isValidRecordingTarget(item: DataSourceInstanceListItem): boolean {
  // A type filter does not stop the list from offering the built-in `-- Grafana --` data source.
  if (!isSupportedExternalPrometheusFlavoredRulesSourceType(item.type)) {
    return false;
  }

  // eslint-disable-next-line @grafana/no-config-datasources
  const settings = config.datasources[item.name];

  // An absent allowAsRecordingRulesTarget means allowed, so an item without settings must be
  // dropped rather than judged on default settings.
  return settings?.uid === item.uid && isValidRecordingRulesTarget(settings);
}

export const RECORDING_TARGET_FILTERS: GetDataSourceInstanceListFilters = Object.freeze({
  type: [...SUPPORTED_EXTERNAL_PROMETHEUS_FLAVORED_RULE_SOURCE_TYPES],
  all: true,
  filter: isValidRecordingTarget,
});

/**
 * The data sources that accept recording rules. The items carry no `jsonData`, so callers cannot
 * re-check the condition; test membership by `uid` instead.
 */
export function getDataSourcesWithValidRecordingTarget(): Promise<DataSourceInstanceListItem[]> {
  return getDataSourceInstanceList(RECORDING_TARGET_FILTERS);
}

function isManagingAlerts(item: DataSourceInstanceListItem): boolean {
  // eslint-disable-next-line @grafana/no-config-datasources
  const settings = config.datasources[item.name];

  // An absent manageAlerts falls back to a config default that is usually true, so an item without
  // settings must be dropped rather than judged on the default.
  return settings?.uid === item.uid && isDataSourceManagingAlerts(settings);
}

export const MANAGING_ALERTS_FILTERS: GetDataSourceInstanceListFilters = Object.freeze({
  // Also keeps the list from appending the built-in `-- Grafana --` data source.
  alerting: true,
  filter: isManagingAlerts,
});

/**
 * The alerting data sources that manage alerts. The items carry no `jsonData`, so callers cannot
 * re-check the condition; test membership by `uid` instead.
 */
export function getDataSourcesManagingAlerts(): Promise<DataSourceInstanceListItem[]> {
  return getDataSourceInstanceList(MANAGING_ALERTS_FILTERS);
}
