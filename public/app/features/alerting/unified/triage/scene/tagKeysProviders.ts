import { MetricFindValue, TimeRange } from '@grafana/data';
import { PromQuery } from '@grafana/prometheus';
import { getDataSourceSrv } from '@grafana/runtime';
import { AdHocFilterWithLabels, AdHocFiltersVariable, GroupByVariable, sceneGraph } from '@grafana/scenes';

import { DATASOURCE_UID, METRIC_NAME } from '../constants';

const COMMON_GROUP = 'Common';
const ALL_GROUP = 'All';
const collator = new Intl.Collator();

/** Labels promoted to the top of the GroupBy dropdown */
const GROUPBY_PROMOTED: MetricFindValue[] = [{ value: 'grafana_folder', text: 'Folder', group: COMMON_GROUP }];

/** Labels promoted to the top of the Filter dropdown */
const FILTER_PROMOTED: MetricFindValue[] = [
  { value: 'alertstate', text: 'State', group: COMMON_GROUP },
  { value: 'alertname', text: 'Rule name', group: COMMON_GROUP },
  { value: 'grafana_folder', text: 'Folder', group: COMMON_GROUP },
];

/** Labels that should never appear in dropdowns */
const EXCLUDED = new Set(['__name__']);

/** Query used to scope label lookups to the alerting metric */
const metricQuery: PromQuery = { refId: 'keys', expr: METRIC_NAME };

/**
 * Fetch tag keys from the configured Prometheus datasource,
 * scoped to the GRAFANA_ALERTS metric.
 */
async function fetchTagKeys(timeRange: TimeRange): Promise<MetricFindValue[]> {
  const ds = await getDataSourceSrv().get({ uid: DATASOURCE_UID });

  if (!ds.getTagKeys) {
    return [];
  }

  const result = await ds.getTagKeys({ filters: [], timeRange, queries: [metricQuery] });

  // getTagKeys can return MetricFindValue[] or GetTagResponse
  return Array.isArray(result) ? result : (result.data ?? []);
}

/**
 * Fetch tag values for a given key from the configured Prometheus datasource,
 * scoped to the GRAFANA_ALERTS metric.
 */
async function fetchTagValues(timeRange: TimeRange, key: string): Promise<MetricFindValue[]> {
  const ds = await getDataSourceSrv().get({ uid: DATASOURCE_UID });

  if (!ds.getTagValues) {
    return [];
  }

  const result = await ds.getTagValues({ key, filters: [], timeRange, queries: [metricQuery] });

  return Array.isArray(result) ? result : (result.data ?? []);
}

/**
 * Fetch tag keys from the datasource, exclude promoted and hidden labels,
 * and return promoted labels first followed by the rest alphabetically.
 */
async function buildTagKeysResult(
  timeRange: TimeRange,
  promoted: MetricFindValue[]
): Promise<{ replace: boolean; values: MetricFindValue[] }> {
  const dsKeys = await fetchTagKeys(timeRange);
  const promotedValues = new Set(promoted.map((p) => String(p.value)));

  const remaining = dsKeys
    .filter((k) => {
      const val = String(k.value ?? k.text);
      return !promotedValues.has(val) && !EXCLUDED.has(val);
    })
    .sort((a, b) => collator.compare(a.text, b.text))
    .map((k) => ({ ...k, group: ALL_GROUP }));

  return { replace: true, values: [...promoted, ...remaining] };
}

/**
 * Provider for the GroupBy variable.
 * Shows promoted labels first, then remaining datasource labels alphabetically.
 */
export function getGroupByTagKeysProvider(variable: GroupByVariable, _currentKey: string | null) {
  const timeRange = sceneGraph.getTimeRange(variable).state.value;
  return buildTagKeysResult(timeRange, GROUPBY_PROMOTED);
}

/**
 * Provider for the AdHoc Filters variable.
 * Shows promoted labels in "Common" group, remaining labels under "Labels".
 */
export function getAdHocTagKeysProvider(variable: AdHocFiltersVariable, _currentKey: string | null) {
  const timeRange = sceneGraph.getTimeRange(variable).state.value;
  return buildTagKeysResult(timeRange, FILTER_PROMOTED);
}

/**
 * Provider for the AdHoc Filters variable tag values.
 * Returns values scoped to the GRAFANA_ALERTS metric.
 */
export async function getAdHocTagValuesProvider(
  variable: AdHocFiltersVariable,
  filter: AdHocFilterWithLabels
): Promise<{ replace: boolean; values: MetricFindValue[] }> {
  const timeRange = sceneGraph.getTimeRange(variable).state.value;
  const values = await fetchTagValues(timeRange, filter.key);
  return { replace: true, values };
}
