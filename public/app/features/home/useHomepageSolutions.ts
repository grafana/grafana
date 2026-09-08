import { useMemo } from 'react';

import { appObservabilitySolution } from './solutions/appObservabilitySolution';
import { SOLUTION_IDS } from './solutions/constants';
import { kubernetesSolution } from './solutions/kubernetesSolution';
import { logsSolution } from './solutions/logsSolution';
import { metricsSolution } from './solutions/metricsSolution';
import { type SolutionState } from './solutions/solutionState';
import { syntheticsSolution } from './solutions/syntheticsSolution';
import { tracesSolution } from './solutions/tracesSolution';
import { type Solution } from './solutions/types';

export interface HomepageSolutions {
  solutions: Solution[];
  /** Aggregate signal snapshot used by the recommendation matrix. */
  signals: () => Promise<SolutionState>;
}

/**
 * Builds one stable solution set for both homepage sections. Construction starts no queries, and
 * stable object identity keeps their async effects from restarting.
 */
export function useHomepageSolutions(): HomepageSolutions {
  return useMemo(() => {
    // The Record makes a missing solution a type error.
    const byId: Record<Solution['id'], Solution> = {
      kubernetes: kubernetesSolution(),
      traces: tracesSolution(),
      metrics: metricsSolution(),
      logs: logsSolution(),
      'app-observability': appObservabilitySolution(),
      synthetics: syntheticsSolution(),
    };

    // Read core signals from their solutions so detection stays owned and memoized there.
    const signals = async (): Promise<SolutionState> => {
      const [metrics, logs, traces, kubernetes, spanMetrics, synthetics] = await Promise.all([
        byId.metrics.signal().catch(() => 'unknown' as const),
        byId.logs.signal().catch(() => 'unknown' as const),
        byId.traces.signal().catch(() => 'unknown' as const),
        byId.kubernetes.signal().catch(() => 'unknown' as const),
        byId['app-observability'].signal().catch(() => 'unknown' as const),
        byId.synthetics.signal().catch(() => 'unknown' as const),
      ]);
      return { metrics, logs, traces, kubernetes, spanMetrics, synthetics };
    };

    return {
      solutions: SOLUTION_IDS.map((id) => byId[id]),
      signals,
    };
  }, []);
}
