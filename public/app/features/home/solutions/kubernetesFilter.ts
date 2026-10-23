import * as z from 'zod';

import { t } from '@grafana/i18n';

import { hasSelection } from './kubernetesData';
import { fetchLabelValues } from './promQuery';
import { DatasourceBoundFilterSchema, parseStoredFilter, TrimmedValues } from './solutionFilter';

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

/** Distinct `key` values in `uid` over the last 24h, optionally narrowed to `cluster` ('' = all). */
export function fetchKubernetesLabelValues(uid: string, key: KubernetesScopeLabel, cluster: string): Promise<string[]> {
  return fetchLabelValues(
    uid,
    key,
    VALUE_SOURCE_METRIC[key],
    cluster ? [{ key: 'cluster', operator: '=', value: cluster }] : []
  );
}
