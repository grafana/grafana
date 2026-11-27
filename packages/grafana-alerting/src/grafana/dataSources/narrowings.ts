import { type DataSourceInstanceListItem } from '@grafana/data';
import { type GetDataSourceInstanceListFilters, getDataSourceInstanceList } from '@grafana/runtime/unstable';

import { getAlertingDataSourceSettings } from './bootDataSettings';
import {
  SUPPORTED_EXTERNAL_PROMETHEUS_FLAVORED_RULE_SOURCE_TYPES,
  isDataSourceManagingAlerts,
  isSupportedExternalPrometheusFlavoredRulesSourceType,
  isValidRecordingRulesTarget,
} from './predicates';

function isValidRecordingTarget(item: DataSourceInstanceListItem): boolean {
  // A type filter does not stop the list from offering the built-in `-- Grafana --` data source.
  if (!isSupportedExternalPrometheusFlavoredRulesSourceType(item.type)) {
    return false;
  }

  const settings = getAlertingDataSourceSettings(item);

  // An absent allowAsRecordingRulesTarget means allowed, so an item without settings must be
  // dropped rather than judged on default settings.
  return settings !== undefined && isValidRecordingRulesTarget(settings);
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
  const settings = getAlertingDataSourceSettings(item);

  // An absent manageAlerts falls back to a config default that is usually true, so an item without
  // settings must be dropped rather than judged on the default.
  return settings !== undefined && isDataSourceManagingAlerts(settings);
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
