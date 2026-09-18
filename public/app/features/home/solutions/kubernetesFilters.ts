import { useCallback, useMemo } from 'react';

import { useStoredString } from 'app/core/hooks/useStored';

export interface KubernetesHomeFilters {
  /** Exact cluster label value; undefined = all clusters. */
  cluster?: string;
  /** Namespace label values; undefined = all namespaces. */
  namespaces?: string[];
  /** Node label values; undefined = all nodes. */
  nodes?: string[];
}

export const KUBERNETES_FILTERS_STORAGE_KEY = 'grafana.home.kubernetes.filters';

// Shared list contract for namespaces and nodes: strings only, trimmed, empties dropped,
// deduped preserving first-seen order.
const cleanLabelValues = (input: unknown): string[] =>
  Array.isArray(input)
    ? [
        ...new Set(
          input
            .filter((v): v is string => typeof v === 'string')
            .map((v) => v.trim())
            .filter(Boolean)
        ),
      ]
    : [];

/** Values are arbitrary Prometheus label values (custom entry allowed), so no shape validation. */
export function normalizeKubernetesFilters(input: unknown): KubernetesHomeFilters {
  if (typeof input !== 'object' || input === null) {
    return {};
  }
  const filters: KubernetesHomeFilters = {};
  if ('cluster' in input && typeof input.cluster === 'string') {
    const cluster = input.cluster.trim();
    if (cluster) {
      filters.cluster = cluster;
    }
  }
  const namespaces = cleanLabelValues('namespaces' in input ? input.namespaces : undefined);
  if (namespaces.length) {
    filters.namespaces = namespaces;
  }
  const nodes = cleanLabelValues('nodes' in input ? input.nodes : undefined);
  if (nodes.length) {
    filters.nodes = nodes;
  }
  return filters;
}

/** Whether any filter narrows the default all-clusters scope. */
export function hasKubernetesFilters(filters: KubernetesHomeFilters): boolean {
  return Boolean(filters.cluster || filters.namespaces?.length || filters.nodes?.length);
}

// Missing or corrupt storage reads as no filters; the next save overwrites it.
function parseKubernetesFilters(raw: string): KubernetesHomeFilters {
  try {
    return normalizeKubernetesFilters(JSON.parse(raw));
  } catch {
    return {};
  }
}

/**
 * The persisted filters and their setter. localStorage-backed like the homepage team filters and
 * the Kubernetes Monitoring app's own datasource choice; every hook instance observes the same key.
 * The filters object changes identity only when the stored value does, so it can key memoization.
 */
export function useKubernetesFilters(): [KubernetesHomeFilters, (filters: KubernetesHomeFilters) => void] {
  const [raw, setRaw] = useStoredString(KUBERNETES_FILTERS_STORAGE_KEY, '');
  const filters = useMemo(() => parseKubernetesFilters(raw), [raw]);
  const save = useCallback(
    (next: KubernetesHomeFilters) => setRaw(JSON.stringify(normalizeKubernetesFilters(next))),
    [setRaw]
  );
  return [filters, save];
}
