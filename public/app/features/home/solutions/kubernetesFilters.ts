import { useCallback, useMemo } from 'react';

import { useStoredString } from 'app/core/hooks/useStored';

/** Label values that scope the card's queries; an absent field leaves that dimension fleet-wide. */
export interface KubernetesFilterValues {
  /** Exact cluster label value. */
  cluster?: string;
  namespaces?: string[];
  nodes?: string[];
}

/**
 * A user's saved pick. The values scope only the datasource they were picked from — the same
 * label values mean something else, or nothing, on another — so ownership is resolved once,
 * through `kubernetesFilterValuesFor`, before any value reaches a query.
 */
export interface KubernetesFilterSelection {
  datasourceUid: string;
  /** Never empty: a selection without values is stored as nothing. */
  values: KubernetesFilterValues;
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
export function normalizeKubernetesFilterValues(input: unknown): KubernetesFilterValues {
  if (typeof input !== 'object' || input === null) {
    return {};
  }
  const values: KubernetesFilterValues = {};
  if ('cluster' in input && typeof input.cluster === 'string') {
    const cluster = input.cluster.trim();
    if (cluster) {
      values.cluster = cluster;
    }
  }
  const namespaces = cleanLabelValues('namespaces' in input ? input.namespaces : undefined);
  if (namespaces.length) {
    values.namespaces = namespaces;
  }
  const nodes = cleanLabelValues('nodes' in input ? input.nodes : undefined);
  if (nodes.length) {
    values.nodes = nodes;
  }
  return values;
}

/** Whether any value narrows the fleet-wide scope. */
export function hasKubernetesFilters(values: KubernetesFilterValues): boolean {
  return Boolean(values.cluster || values.namespaces?.length || values.nodes?.length);
}

/** A stored or submitted selection; null unless a datasource uid binds at least one value. */
export function normalizeKubernetesFilterSelection(input: unknown): KubernetesFilterSelection | null {
  if (typeof input !== 'object' || input === null) {
    return null;
  }
  const datasourceUid =
    'datasourceUid' in input && typeof input.datasourceUid === 'string' ? input.datasourceUid.trim() : '';
  const values = normalizeKubernetesFilterValues('values' in input ? input.values : undefined);
  return datasourceUid && hasKubernetesFilters(values) ? { datasourceUid, values } : null;
}

/** The saved values for the datasource they were picked from; any other datasource reads unscoped. */
export function kubernetesFilterValuesFor(
  selection: KubernetesFilterSelection | null,
  datasourceUid: string
): KubernetesFilterValues {
  return selection?.datasourceUid === datasourceUid ? selection.values : {};
}

// Missing or corrupt storage reads as no selection; the next save overwrites it.
function parseKubernetesFilterSelection(raw: string): KubernetesFilterSelection | null {
  try {
    return normalizeKubernetesFilterSelection(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * The persisted selection and its setter. localStorage-backed like the homepage team filters and
 * the Kubernetes Monitoring app's own datasource choice; every hook instance observes the same key.
 * The selection changes identity only when the stored value does, so it can key memoization.
 */
export function useKubernetesFilterSelection(): [
  KubernetesFilterSelection | null,
  (selection: KubernetesFilterSelection | null) => void,
] {
  const [raw, setRaw] = useStoredString(KUBERNETES_FILTERS_STORAGE_KEY, '');
  const selection = useMemo(() => parseKubernetesFilterSelection(raw), [raw]);
  const save = useCallback(
    (next: KubernetesFilterSelection | null) => {
      const normalized = normalizeKubernetesFilterSelection(next);
      setRaw(normalized ? JSON.stringify(normalized) : '');
    },
    [setRaw]
  );
  return [selection, save];
}
