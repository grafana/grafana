import memoize from 'micro-memoize';
import { useMemo } from 'react';

import { useStoredString } from 'app/core/hooks/useStored';

import { SOLUTION_IDS } from './solutions/constants';
import { detectIrmSignal } from './solutions/irmSignal';
import { parseKubernetesFilter } from './solutions/kubernetesFilter';
import { kubernetesDetection, kubernetesSolution } from './solutions/kubernetesSolution';
import { logsSolution } from './solutions/logsSolution';
import { parseMetricsFilter } from './solutions/metricsFilter';
import { metricsDetection, metricsSolution } from './solutions/metricsSolution';
import { solutionFilterStorageKey } from './solutions/solutionFilter';
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
 * object identity keeps their async effects from restarting. The stored card filters are the only
 * reactive inputs: a change recreates just that filter's solution, so every consumer re-reads its facts.
 */
export function useHomepageSolutions(): HomepageSolutions {
  const [rawKubernetesFilter] = useStoredString(solutionFilterStorageKey('kubernetes'), '');
  const [rawMetricsFilter] = useStoredString(solutionFilterStorageKey('metrics'), '');

  // Built once: the filter-independent solutions, the span-metrics probe, the detections every
  // recreated filtered solution shares, and the signal snapshot read from them.
  const shared = useMemo(() => {
    const detectKubernetes = kubernetesDetection();
    const detectMetrics = metricsDetection();
    const solutions = {
      traces: tracesSolution(),
      logs: logsSolution(),
      synthetics: syntheticsSolution(),
    };

    // App Observability and IRM are not homepage solutions; only the recommendation matrix reads these signals.
    const spanMetricsSignal = memoize(() => detectSignal(probeSpanMetrics));
    const irmSignal = memoize(detectIrmSignal);

    // Core signals come from their solutions; the filtered ones from the detection their solutions
    // share, so a filter change never re-probes and never restarts recommendation selection.
    const status = (detect: () => Promise<{ status: SolutionState[keyof SolutionState] }>) =>
      detect()
        .then(({ status }) => status)
        .catch(() => 'unknown' as const);
    const signals = async (): Promise<SolutionState> => {
      const [metrics, logs, traces, kubernetes, spanMetrics, synthetics, irm] = await Promise.all([
        status(detectMetrics),
        solutions.logs.signal().catch(() => 'unknown' as const),
        solutions.traces.signal().catch(() => 'unknown' as const),
        status(detectKubernetes),
        status(spanMetricsSignal),
        solutions.synthetics.signal().catch(() => 'unknown' as const),
        irmSignal().catch(() => 'unknown' as const),
      ]);
      return { metrics, logs, traces, kubernetes, spanMetrics, synthetics, irm };
    };

    return { detectKubernetes, detectMetrics, solutions, signals };
  }, []);

  // Saving or clearing a filter recreates only its solution, so every consumer re-reads its facts.
  const kubernetes = useMemo(
    () => kubernetesSolution(parseKubernetesFilter(rawKubernetesFilter), shared.detectKubernetes),
    [rawKubernetesFilter, shared]
  );
  const metrics = useMemo(
    () => metricsSolution(parseMetricsFilter(rawMetricsFilter), shared.detectMetrics),
    [rawMetricsFilter, shared]
  );

  return useMemo(() => {
    // The Record makes a missing solution a type error.
    const byId: Record<Solution['id'], Solution> = { kubernetes, metrics, ...shared.solutions };
    return { solutions: SOLUTION_IDS.map((id) => byId[id]), signals: shared.signals };
  }, [kubernetes, metrics, shared]);
}
