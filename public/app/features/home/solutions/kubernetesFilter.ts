import * as z from 'zod';

import { type MetricFindValue, rangeUtil } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type PromQuery } from '@grafana/prometheus';
import { getDataSourceInstance } from '@grafana/runtime/unstable';

import { hasSelection } from './kubernetesData';
import { DatasourceBoundFilterSchema, parseStoredFilter } from './solutionFilter';

// An empty regex alternative would match series that lack the label, so blank entries are dropped.
const TrimmedValues = z
  .array(z.string())
  .transform((values) => values.map((value) => value.trim()).filter((value) => value !== ''));

const KubernetesFilterSchema = DatasourceBoundFilterSchema.extend({
  cluster: z.string().trim(),
  namespaces: TrimmedValues,
  nodes: TrimmedValues,
});

export type KubernetesFilter = z.infer<typeof KubernetesFilterSchema>;

/** Stored JSON → filter. Null for a missing/malformed value or an empty selection: both mean fleet-wide. */
export function parseKubernetesFilter(raw: string | undefined): KubernetesFilter | null {
  return parseStoredFilter(raw, KubernetesFilterSchema, (filter) => !hasSelection(filter));
}

/** Human summary for tooltips: non-empty parts joined with ' · '. */
export function summarizeKubernetesFilter(filter: KubernetesFilter): string {
  const parts: string[] = [];
  if (filter.cluster) {
    parts.push(
      t('home.solutions.kubernetes.filter.summary-cluster', 'Cluster: {{cluster}}', {
        cluster: filter.cluster,
        interpolation: { escapeValue: false },
      })
    );
  }
  if (filter.namespaces.length > 0) {
    parts.push(
      t('home.solutions.kubernetes.filter.summary-namespaces', 'Namespaces: {{namespaces}}', {
        namespaces: filter.namespaces.join(', '),
        interpolation: { escapeValue: false },
      })
    );
  }
  if (filter.nodes.length > 0) {
    parts.push(
      t('home.solutions.kubernetes.filter.summary-nodes', 'Nodes: {{nodes}}', {
        nodes: filter.nodes.join(', '),
        interpolation: { escapeValue: false },
      })
    );
  }
  return parts.join(' · ');
}

export type KubernetesScopeLabel = 'cluster' | 'namespace' | 'node';

// Same kube-state-metrics series the card counts; namespaces mirror the datasource probe.
const VALUE_SOURCE_METRIC: Record<KubernetesScopeLabel, string> = {
  cluster: 'kube_node_info',
  namespace: 'kube_namespace_status_phase',
  node: 'kube_node_info',
};

// Matches the inventory lookback (KUBE_STATE_LOOKBACK).
const VALUES_RANGE = { from: 'now-24h', to: 'now' };

/**
 * Distinct `key` values in `uid` over the last 24h, optionally narrowed to `cluster` ('' = all). The
 * Prometheus datasource caches label values per snapped time range itself (1–60 min by cacheLevel),
 * so reopening the dialog inside that window issues no request and a moved window refreshes the list.
 */
export async function fetchKubernetesLabelValues(
  uid: string,
  key: KubernetesScopeLabel,
  cluster: string
): Promise<string[]> {
  const ds = await getDataSourceInstance({ uid });
  if (!ds.getTagValues) {
    return [];
  }
  const query: PromQuery = { refId: 'values', expr: VALUE_SOURCE_METRIC[key] };
  const result = await ds.getTagValues({
    key,
    filters: cluster ? [{ key: 'cluster', operator: '=', value: cluster }] : [],
    timeRange: rangeUtil.convertRawToRange(VALUES_RANGE),
    queries: [query],
  });
  const values: MetricFindValue[] = Array.isArray(result) ? result : (result.data ?? []);
  return values.map((v) => String(v.value ?? v.text));
}
