/**
 * Pure recommendation matrix ("Homepage Led Growth" analytics matrix), scoped to Logs, Traces
 * (Hosted Traces) and Kubernetes Monitoring. No I/O: signal detection lives in solutionState.ts.
 */

export type SignalStatus = 'active' | 'inactive' | 'unknown';

export interface SolutionState {
  metrics: SignalStatus;
  logs: SignalStatus;
  traces: SignalStatus;
  kubernetes: SignalStatus;
}

export type RecommendedCardId = 'enable-logs' | 'enable-logs-k8s' | 'hosted-traces' | 'kubernetes-monitoring';

/**
 * Matrix row that drove the selection — a selection driver id for analytics
 * (`starting_state`), not a full state descriptor.
 */
export type BaseRow =
  | 'empty'
  | 'logs_only'
  | 'partial_telemetry'
  | 'metrics_only'
  | 'k8s_no_logs'
  | 'ml_no_traces'
  | 'mlk_no_traces'
  | 'mlt'
  | 'fully_active'
  | 'unknown';

export interface RecommendationSelection {
  cards: RecommendedCardId[];
  baseRow: BaseRow;
}

/**
 * Select the recommendation cards for a settled solution state.
 *
 * Any `unknown` signal short-circuits to no cards: a transient probe failure must never select
 * a wrong row or pollute `starting_state`; the probe TTL re-resolves shortly. Kubernetes data
 * implies metrics (kube-state-metrics live in a Prometheus), so `kubernetes` active with
 * `metrics` inactive is unreachable — solutionState enforces the invariant.
 */
export function selectRecommendations(state: SolutionState): RecommendationSelection {
  const { metrics, logs, traces, kubernetes } = state;
  if (metrics === 'unknown' || logs === 'unknown' || traces === 'unknown' || kubernetes === 'unknown') {
    return { cards: [], baseRow: 'unknown' };
  }

  if (metrics === 'inactive') {
    // Without the metrics foundation nothing in scope is recommendable: the "Logs-only" row
    // recommends Metrics (separate workstream) and gates Traces on confirmed metrics.
    if (logs === 'inactive' && traces === 'inactive') {
      return { cards: [], baseRow: 'empty' };
    }
    if (logs === 'active' && traces === 'inactive') {
      return { cards: [], baseRow: 'logs_only' };
    }
    return { cards: [], baseRow: 'partial_telemetry' };
  }

  if (logs === 'inactive') {
    // Logs is PRIMARY before any traces/k8s recommendation; the K8s row only changes the copy
    // (Helm values flag). The row's Traces cell is moot when traces are already active.
    return kubernetes === 'active'
      ? { cards: ['enable-logs-k8s'], baseRow: 'k8s_no_logs' }
      : { cards: ['enable-logs'], baseRow: 'metrics_only' };
  }

  if (traces === 'inactive') {
    // Distinct rows so Hosted Traces clicks segment by Kubernetes presence.
    return kubernetes === 'active'
      ? { cards: ['hosted-traces'], baseRow: 'mlk_no_traces' }
      : { cards: ['hosted-traces', 'kubernetes-monitoring'], baseRow: 'ml_no_traces' };
  }

  return kubernetes === 'active'
    ? { cards: [], baseRow: 'fully_active' }
    : { cards: ['kubernetes-monitoring'], baseRow: 'mlt' };
}
