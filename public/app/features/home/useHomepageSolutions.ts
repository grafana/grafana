import memoize from 'micro-memoize';
import { useMemo } from 'react';

import { SOLUTION_IDS } from './solutions/constants';
import { useKubernetesFilters } from './solutions/kubernetesFilters';
import { kubernetesSignal, kubernetesSolution } from './solutions/kubernetesSolution';
import { logsSolution } from './solutions/logsSolution';
import { metricsSolution } from './solutions/metricsSolution';
import { detectSignal, type SolutionState } from './solutions/solutionState';
import { probeSpanMetrics } from './solutions/spanMetricsSignal';
import { syntheticsSolution } from './solutions/syntheticsSolution';
import { tracesSolution } from './solutions/tracesSolution';
import { type Solution, type SolutionId } from './solutions/types';

export interface HomepageSolutions {
  solutions: Solution[];
  /** Aggregate signal snapshot used by the recommendation matrix. */
  signals: () => Promise<SolutionState>;
}

/**
 * Builds one solution set for both homepage sections. Construction starts no queries, and stable
 * object identity keeps their async effects from restarting — only the Kubernetes solution is
 * rebuilt when its persisted filters change, so just that card refetches.
 */
export function useHomepageSolutions(): HomepageSolutions {
  const [kubernetesFilters] = useKubernetesFilters();
  const kubernetes = useMemo(() => kubernetesSolution(kubernetesFilters), [kubernetesFilters]);

  const stable = useMemo(() => {
    const byId = {
      traces: tracesSolution(),
      metrics: metricsSolution(),
      logs: logsSolution(),
      synthetics: syntheticsSolution(),
    };

    // App Observability is not a homepage solution; only the recommendation matrix reads this signal.
    const spanMetricsSignal = memoize(() => detectSignal(probeSpanMetrics));
    // Detection is filter-independent, so the snapshot reads it directly rather than through the
    // kubernetes instance, which is rebuilt on every filter save.
    const kubernetesDetection = memoize(kubernetesSignal);

    // Read core signals from their solutions so detection stays owned and memoized there.
    const signals = async (): Promise<SolutionState> => {
      const [metrics, logs, traces, kubernetesStatus, spanMetrics, synthetics] = await Promise.all([
        byId.metrics.signal().catch(() => 'unknown' as const),
        byId.logs.signal().catch(() => 'unknown' as const),
        byId.traces.signal().catch(() => 'unknown' as const),
        kubernetesDetection()
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

  return useMemo(() => {
    // The Record makes a missing solution a type error.
    const byId: Record<SolutionId, Solution> = { ...stable.byId, kubernetes };
    return { solutions: SOLUTION_IDS.map((id) => byId[id]), signals: stable.signals };
  }, [kubernetes, stable]);
}
