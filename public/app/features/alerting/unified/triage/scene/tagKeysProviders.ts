import { MetricFindValue, TimeRange } from '@grafana/data';
import { PromQuery } from '@grafana/prometheus';
import { getDataSourceSrv } from '@grafana/runtime';
import { AdHocFilterWithLabels, AdHocFiltersVariable, GroupByVariable, sceneGraph } from '@grafana/scenes';

import { DATASOURCE_UID, METRIC_NAME } from '../constants';

const COMMON_GROUP = 'Common';
const FREQUENT_GROUP = 'Frequent';
const ALL_GROUP = 'All';
const TOP_LABEL_COUNT = 5;
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

/** Internal/structural labels to exclude from frequency counting */
export const INTERNAL_LABELS = new Set([
  '__name__',
  'alertname',
  'alertstate',
  'folderUID',
  'from',
  'grafana_alertstate',
  'grafana_folder',
  'grafana_rule_uid',
  'orgID',
]);

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
 * Fetch series for GRAFANA_ALERTS and return the top N label keys
 * ordered by how many instances carry each label.
 */
async function fetchTopLabelKeys(timeRange: TimeRange): Promise<string[]> {
  const ds = await getDataSourceSrv().get({ uid: DATASOURCE_UID });

  if (!('getResource' in ds) || typeof ds.getResource !== 'function') {
    return [];
  }

  const response = await ds.getResource('api/v1/series', {
    'match[]': METRIC_NAME,
    start: String(timeRange.from.unix()),
    end: String(timeRange.to.unix()),
  });

  const series: Array<Record<string, string>> = response?.data ?? [];
  const counts = new Map<string, number>();

  for (const s of series) {
    for (const key of Object.keys(s)) {
      if (!INTERNAL_LABELS.has(key)) {
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_LABEL_COUNT)
    .map(([key]) => key);
}

/**
 * Fetch tag keys from the datasource, exclude promoted and hidden labels,
 * and return promoted labels first followed by the rest alphabetically.
 */
async function buildTagKeysResult(
  timeRange: TimeRange,
  promoted: MetricFindValue[]
): Promise<{ replace: boolean; values: MetricFindValue[] }> {
  const [dsKeys, topKeys] = await Promise.all([fetchTagKeys(timeRange), fetchTopLabelKeys(timeRange)]);

  const promotedValues = new Set(promoted.map((p) => String(p.value)));
  const topKeysSet = new Set(topKeys);

  // Build "Frequent" group from top keys (excluding any already in promoted)
  const frequent = topKeys
    .filter((key) => !promotedValues.has(key))
    .map((key) => ({ value: key, text: key, group: FREQUENT_GROUP }));

  // Remaining go to "All" — exclude promoted, frequent, and hidden
  const excludeFromAll = new Set([...promotedValues, ...topKeysSet, ...EXCLUDED]);
  const remaining = dsKeys
    .filter((k) => {
      const val = String(k.value ?? k.text);
      return !excludeFromAll.has(val);
    })
    .sort((a, b) => collator.compare(a.text, b.text))
    .map((k) => ({ ...k, group: ALL_GROUP }));

  return { replace: true, values: [...promoted, ...frequent, ...remaining] };
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
