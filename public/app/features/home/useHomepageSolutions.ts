import memoize from 'micro-memoize';
import { useMemo, useSyncExternalStore } from 'react';

import { SOLUTION_IDS } from './solutions/constants';
import { resolveKubernetesDatasource } from './solutions/kubernetesData';
import { getKubernetesFiltersVersion, subscribeKubernetesFilters } from './solutions/kubernetesFilters';
import { kubernetesSolution } from './solutions/kubernetesSolution';
import { logsSolution } from './solutions/logsSolution';
import { metricsSolution } from './solutions/metricsSolution';
import { detectSignal, type SolutionState } from './solutions/solutionState';
import { probeSpanMetrics } from './solutions/spanMetricsSignal';
import { syntheticsSolution } from './solutions/syntheticsSolution';
import { tracesSolution } from './solutions/tracesSolution';
import { type Solution } from './solutions/types';

export interface HomepageSolutions {
  solutions: Solution[];
  /** Aggregate signal snapshot used by the recommendation matrix. */
  signals: () => Promise<SolutionState>;
}

/**
 * Builds one solution set for both homepage sections. Construction starts no queries, and stable
 * object identity keeps their async effects from restarting — only the Kubernetes solution is
 * rebuilt when its per-user filters change, so just that card refetches.
 */
export function useHomepageSolutions(): HomepageSolutions {
  const filtersVersion = useSyncExternalStore(subscribeKubernetesFilters, getKubernetesFiltersVersion);
  // The version is a rebuild key, not an input: the factory reads the filters itself at fetch time.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const kubernetes = useMemo(() => kubernetesSolution(), [filtersVersion]);

  const stable = useMemo(() => {
    // The Record makes a missing solution a type error.
    const byId: Record<Exclude<Solution['id'], 'kubernetes'>, Solution> = {
      traces: tracesSolution(),
      metrics: metricsSolution(),
      logs: logsSolution(),
      synthetics: syntheticsSolution(),
    };

    // App Observability is not a homepage solution; only the recommendation matrix reads this signal.
    const spanMetricsSignal = memoize(() => detectSignal(probeSpanMetrics));
    // Detection is filter-independent and module-TTL-cached, so signals must not depend on the
    // rebuilt kubernetes instance: read the same detection directly.
    const kubernetesSignal = memoize(() => detectSignal(resolveKubernetesDatasource));

    // Read core signals from their solutions so detection stays owned and memoized there.
    const signals = async (): Promise<SolutionState> => {
      const [metrics, logs, traces, kubernetesStatus, spanMetrics, synthetics] = await Promise.all([
        byId.metrics.signal().catch(() => 'unknown' as const),
        byId.logs.signal().catch(() => 'unknown' as const),
        byId.traces.signal().catch(() => 'unknown' as const),
        kubernetesSignal()
          .then(({ status }) => status)
          .catch(() => 'unknown' as const),
        spanMetricsSignal()
          .then(({ status }) => status)
          .catch(() => 'unknown' as const),
        byId.synthetics.signal().catch(() => 'unknown' as const),
      ]);
      return { metrics, logs, traces, kubernetes: kubernetesStatus, spanMetrics, synthetics };
    };

    return { byId, signals };
  }, []);

  return useMemo(
    () => ({
      solutions: SOLUTION_IDS.map((id) => (id === 'kubernetes' ? kubernetes : stable.byId[id])),
      signals: stable.signals,
    }),
    [kubernetes, stable]
  );
}
