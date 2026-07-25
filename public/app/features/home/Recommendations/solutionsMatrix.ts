/**
 * Pure recommendation matrix ("Homepage Led Growth" analytics matrix), scoped to Logs, Traces
 * (Hosted Traces), Kubernetes Monitoring and Application Observability. No I/O: signal
 * detection lives in solutionState.ts.
 */

export type SignalStatus = 'active' | 'inactive' | 'unknown';

export interface SolutionState {
  metrics: SignalStatus;
  logs: SignalStatus;
  traces: SignalStatus;
  kubernetes: SignalStatus;
  /**
   * Span metrics in the org's Prometheus — the "App Observability in use" signal. Only gates
   * the application-observability card and fails toward hiding it: unlike the core signals,
   * 'unknown' never blanks the selection.
   */
  spanMetrics: SignalStatus;
}

export type RecommendedCardId =
  | 'connect-metrics'
  | 'enable-logs'
  | 'enable-logs-k8s'
  | 'hosted-traces'
  | 'kubernetes-monitoring'
  | 'application-observability';

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
  const { metrics, logs, traces, kubernetes, spanMetrics } = state;
  // The core-signal short-circuit deliberately excludes spanMetrics: it only gates one card.
  if (metrics === 'unknown' || logs === 'unknown' || traces === 'unknown' || kubernetes === 'unknown') {
    return { cards: [], baseRow: 'unknown' };
  }

  if (metrics === 'inactive') {
    // Empty orgs still get a full onboarding carousel: the three telemetry pillars.
    if (logs === 'inactive' && traces === 'inactive') {
      return { cards: ['connect-metrics', 'enable-logs', 'hosted-traces'], baseRow: 'empty' };
    }
    // Metrics is the foundation gate: the "Logs-only" row recommends Metrics, and partial
    // telemetry without metrics funnels there too before anything else.
    if (logs === 'active' && traces === 'inactive') {
      return { cards: ['connect-metrics'], baseRow: 'logs_only' };
    }
    return { cards: ['connect-metrics'], baseRow: 'partial_telemetry' };
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

  // M+L+T (OTel starters): App Observability unless span metrics show it is already in use.
  const appO11y: RecommendedCardId[] = spanMetrics === 'inactive' ? ['application-observability'] : [];
  return kubernetes === 'active'
    ? { cards: appO11y, baseRow: 'fully_active' }
    : { cards: [...appO11y, 'kubernetes-monitoring'], baseRow: 'mlt' };
}
