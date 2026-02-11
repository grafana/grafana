import { MetricFindValue } from '@grafana/data';
import { PromQuery } from '@grafana/prometheus';
import { getDataSourceSrv } from '@grafana/runtime';
import { AdHocFilterWithLabels, AdHocFiltersVariable, GroupByVariable, SceneObject, sceneGraph } from '@grafana/scenes';

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
async function fetchTagKeys(sceneObject: SceneObject): Promise<MetricFindValue[]> {
  const ds = await getDataSourceSrv().get({ uid: DATASOURCE_UID });

  if (!ds.getTagKeys) {
    return [];
  }

  const timeRange = sceneGraph.getTimeRange(sceneObject).state.value;
  const result = await ds.getTagKeys({ filters: [], timeRange, queries: [metricQuery] });

  // getTagKeys can return MetricFindValue[] or GetTagResponse
  return Array.isArray(result) ? result : (result.data ?? []);
}

/**
 * Fetch tag values for a given key from the configured Prometheus datasource,
 * scoped to the GRAFANA_ALERTS metric.
 */
async function fetchTagValues(sceneObject: SceneObject, key: string): Promise<MetricFindValue[]> {
  const ds = await getDataSourceSrv().get({ uid: DATASOURCE_UID });

  if (!ds.getTagValues) {
    return [];
  }

  const timeRange = sceneGraph.getTimeRange(sceneObject).state.value;
  const result = await ds.getTagValues({ key, filters: [], timeRange, queries: [metricQuery] });

  return Array.isArray(result) ? result : (result.data ?? []);
}

/**
 * Provider for the GroupBy variable.
 * Shows promoted labels first, then remaining datasource labels alphabetically.
 */
export async function getGroupByTagKeysProvider(
  variable: GroupByVariable,
  _currentKey: string | null
): Promise<{ replace: boolean; values: MetricFindValue[] }> {
  const dsKeys = await fetchTagKeys(variable);
  const promotedValues = new Set(GROUPBY_PROMOTED.map((p) => String(p.value)));

  const remaining = dsKeys
    .filter((k) => {
      const val = String(k.value ?? k.text);
      return !promotedValues.has(val) && !EXCLUDED.has(val);
    })
    .sort((a, b) => collator.compare(a.text, b.text))
    .map((k) => ({ ...k, group: ALL_GROUP }));

  return { replace: true, values: [...GROUPBY_PROMOTED, ...remaining] };
}

/**
 * Provider for the AdHoc Filters variable.
 * Shows promoted labels in "Common" group, remaining labels under "Labels".
 */
export async function getAdHocTagKeysProvider(
  variable: AdHocFiltersVariable,
  _currentKey: string | null
): Promise<{ replace: boolean; values: MetricFindValue[] }> {
  const dsKeys = await fetchTagKeys(variable);
  const promotedValues = new Set(FILTER_PROMOTED.map((p) => String(p.value)));

  const remaining = dsKeys
    .filter((k) => {
      const val = String(k.value ?? k.text);
      return !promotedValues.has(val) && !EXCLUDED.has(val);
    })
    .sort((a, b) => collator.compare(a.text, b.text))
    .map((k) => ({ ...k, group: ALL_GROUP }));

  return { replace: true, values: [...FILTER_PROMOTED, ...remaining] };
}

/**
 * Provider for the AdHoc Filters variable tag values.
 * Returns values scoped to the GRAFANA_ALERTS metric.
 */
export async function getAdHocTagValuesProvider(
  variable: AdHocFiltersVariable,
  filter: AdHocFilterWithLabels
): Promise<{ replace: boolean; values: MetricFindValue[] }> {
  const values = await fetchTagValues(variable, filter.key);
  return { replace: true, values };
}
