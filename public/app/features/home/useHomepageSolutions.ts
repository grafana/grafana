import memoize from 'micro-memoize';
import { useMemo } from 'react';

import { useStoredString } from 'app/core/hooks/useStored';

import { SOLUTION_IDS } from './solutions/constants';
import { detectIrmSignal } from './solutions/irmSignal';
import { kubernetesFilterStorageKey, parseKubernetesFilter } from './solutions/kubernetesFilter';
import { kubernetesDetection, kubernetesSolution } from './solutions/kubernetesSolution';
import { logsSolution } from './solutions/logsSolution';
import { metricsSolution } from './solutions/metricsSolution';
import { detectSignal, settleSignals, type SolutionState } from './solutions/solutionState';
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
 * object identity keeps their async effects from restarting. The stored Kubernetes filter is the only
 * reactive input: a change recreates just the Kubernetes solution, so every consumer re-reads its facts.
 */
export function useHomepageSolutions(): HomepageSolutions {
  const [rawFilter] = useStoredString(kubernetesFilterStorageKey(), '');

  // Built once: the filter-independent solutions, the span-metrics probe, the Kubernetes detection
  // every recreated Kubernetes solution shares, and the signal snapshot read from them.
  const shared = useMemo(() => {
    const detectKubernetes = kubernetesDetection();
    const solutions = {
      traces: tracesSolution(),
      metrics: metricsSolution(),
      logs: logsSolution(),
      synthetics: syntheticsSolution(),
    };

    // App Observability and IRM are not homepage solutions; only the recommendation matrix reads these signals.
    const spanMetricsSignal = memoize(() => detectSignal(probeSpanMetrics));
    const irmSignal = memoize(detectIrmSignal);

    // Core signals come from their solutions; the Kubernetes one from the detection its solutions
    // share, so a filter change never re-probes and never restarts recommendation selection.
    const signals = (): Promise<SolutionState> =>
      settleSignals({
        metrics: solutions.metrics.signal(),
        logs: solutions.logs.signal(),
        traces: solutions.traces.signal(),
        kubernetes: detectKubernetes().then(({ status }) => status),
        spanMetrics: spanMetricsSignal().then(({ status }) => status),
        synthetics: solutions.synthetics.signal(),
        irm: irmSignal(),
      });

    return { detectKubernetes, solutions, signals };
  }, []);

  // Saving or clearing the filter recreates only the Kubernetes solution, so every consumer re-reads its facts.
  const kubernetes = useMemo(
    () => kubernetesSolution(parseKubernetesFilter(rawFilter), shared.detectKubernetes),
    [rawFilter, shared]
  );

  return useMemo(() => {
    // The Record makes a missing solution a type error.
    const byId: Record<Solution['id'], Solution> = { kubernetes, ...shared.solutions };
    return { solutions: SOLUTION_IDS.map((id) => byId[id]), signals: shared.signals };
  }, [kubernetes, shared]);
}
