import type { MetricFindValue, TimeRange } from '@grafana/data/types';
import { type PromQuery } from '@grafana/prometheus';
import { getDataSourceSrv } from '@grafana/runtime';
import {
  type AdHocFilterWithLabels,
  type AdHocFiltersVariable,
  type GroupByVariable,
  sceneGraph,
} from '@grafana/scenes';

import { COMBINED_FILTER_LABEL_KEYS, DATASOURCE_UID, METRIC_NAME } from '../constants';

const COMMON_GROUP = 'Common';
const ALL_GROUP = 'All';
const collator = new Intl.Collator();
type CombinedFilterKey = keyof typeof COMBINED_FILTER_LABEL_KEYS;

function isCombinedFilterKey(key: string): key is CombinedFilterKey {
  return key in COMBINED_FILTER_LABEL_KEYS;
}

/** Labels promoted to the top of the GroupBy dropdown */
const GROUPBY_PROMOTED: MetricFindValue[] = [
  { value: 'grafana_folder', text: 'Folder', group: COMMON_GROUP },
  { value: 'cluster', text: 'Cluster', group: COMMON_GROUP },
  { value: 'namespace', text: 'Namespace', group: COMMON_GROUP },
];

/** Labels that should never appear in dropdowns */
const EXCLUDED = new Set<string>([
  '__name__',
  ...Object.values(COMBINED_FILTER_LABEL_KEYS).flatMap((keys) => keys.slice(1)),
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
 * Fetch tag keys from the datasource, exclude hidden labels and any promoted labels,
 * and return promoted labels first followed by the rest alphabetically.
 */
async function buildTagKeysResult(
  timeRange: TimeRange,
  promoted: MetricFindValue[] = []
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
 * Returns datasource labels under the "All" group.
 */
export function getAdHocTagKeysProvider(variable: AdHocFiltersVariable, _currentKey: string | null) {
  const timeRange = sceneGraph.getTimeRange(variable).state.value;
  return buildTagKeysResult(timeRange);
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
  if (isCombinedFilterKey(filter.key)) {
    const combinedKeys = COMBINED_FILTER_LABEL_KEYS[filter.key];
    const allValues = (await Promise.all(combinedKeys.map((key) => fetchTagValues(timeRange, key)))).flat();
    const dedupedValues = Array.from(new Map(allValues.map((v) => [String(v.value ?? v.text ?? ''), v])).values()).sort(
      (a, b) => collator.compare(String(a.text ?? a.value ?? ''), String(b.text ?? b.value ?? ''))
    );
    return { replace: true, values: dedupedValues };
  }

  const values = await fetchTagValues(timeRange, filter.key);
  return { replace: true, values };
}
