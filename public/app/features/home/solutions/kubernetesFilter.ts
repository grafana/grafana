import * as z from 'zod';

import { type MetricFindValue, rangeUtil } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type PromQuery } from '@grafana/prometheus';
import { getDataSourceInstance } from '@grafana/runtime/unstable';
import { contextSrv } from 'app/core/services/context_srv';

import { hasSelection } from './kubernetesData';

/**
 * localStorage key of the current org's Kubernetes card scope (JSON of KubernetesFilter). Datasource
 * uids are unique per org, so the key carries the org id like Explore's last-used datasource does;
 * the browser profile is the user boundary, as for the sibling homepage filters.
 */
export function kubernetesFilterStorageKey(): string {
  return `grafana.home.kubernetes.filter.${contextSrv.user.orgId}`;
}

// An empty regex alternative would match series that lack the label, so blank entries are dropped.
const TrimmedValues = z
  .array(z.string())
  .transform((values) => values.map((value) => value.trim()).filter((value) => value !== ''));

const KubernetesFilterSchema = z.object({
  /** Datasource the values were picked from; the scope applies only while the card reads it. */
  datasourceUid: z.string(),
  /** For the "not applied" message when the card resolves another datasource. */
  datasourceName: z.string(),
  cluster: z.string().trim(),
  namespaces: TrimmedValues,
  nodes: TrimmedValues,
});

export type KubernetesFilter = z.infer<typeof KubernetesFilterSchema>;

/** Stored JSON → filter. Null for a missing/malformed value or an empty selection: both mean fleet-wide. */
export function parseKubernetesFilter(raw: string | undefined): KubernetesFilter | null {
  if (!raw) {
    return null;
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  const result = KubernetesFilterSchema.safeParse(json);
  return result.success && hasSelection(result.data) ? result.data : null;
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
