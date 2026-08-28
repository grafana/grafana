import { UserStorage } from '@grafana/runtime/internal';

export interface KubernetesHomeFilters {
  /** Exact cluster label value; undefined = all clusters. */
  cluster?: string;
  /** Namespace label values; undefined = all namespaces. */
  namespaces?: string[];
  /** Node label values; undefined = all nodes. */
  nodes?: string[];
}

const storage = new UserStorage('grafana-home');
const KEY = 'kubernetes-filters';

// One consistent in-memory snapshot for every consumer (fetchers, badge, caption): storage is
// read once, then only saves replace it — which also sidesteps UserStorage's stale-cache edge
// after a failed PATCH.
let snapshot: KubernetesHomeFilters | undefined;
let pendingLoad: Promise<KubernetesHomeFilters> | undefined;
let version = 0;
const listeners = new Set<() => void>();

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

export async function getKubernetesFilters(): Promise<KubernetesHomeFilters> {
  if (snapshot) {
    return snapshot;
  }
  pendingLoad ??= (async () => {
    let loaded: KubernetesHomeFilters = {};
    try {
      const stored = await storage.getItem(KEY);
      loaded = stored ? normalizeKubernetesFilters(JSON.parse(stored)) : {};
    } catch {
      // Unreadable or corrupt storage reads as no filters; a later save overwrites it.
    }
    snapshot = loaded;
    return loaded;
  })();
  return pendingLoad;
}

/** Rejects when persisting fails; the snapshot then keeps the last persisted value. */
export async function saveKubernetesFilters(filters: KubernetesHomeFilters): Promise<void> {
  const normalized = normalizeKubernetesFilters(filters);
  await storage.setItem(KEY, JSON.stringify(normalized));
  snapshot = normalized;
  version++;
  listeners.forEach((listener) => listener());
}

export function subscribeKubernetesFilters(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Bumps on every successful save; `useSyncExternalStore` snapshot. */
export function getKubernetesFiltersVersion(): number {
  return version;
}

// Reset the module state (test seam).
export function resetKubernetesFilters(): void {
  snapshot = undefined;
  pendingLoad = undefined;
  version = 0;
  listeners.clear();
}
