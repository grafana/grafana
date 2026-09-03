/**
 * Pure recommendation matrix ("Homepage Led Growth" analytics matrix), scoped to Logs, Traces
 * (Hosted Traces), Kubernetes Monitoring, Application Observability and Synthetic Monitoring.
 * No I/O: signal detection lives in solutionState.ts.
 */

import { type SolutionState } from '../solutions/solutionState';
import { type SolutionId } from '../solutions/types';

export type RecommendedCardId =
  | 'connect-metrics'
  | 'enable-logs'
  | 'enable-logs-k8s'
  | 'hosted-traces'
  | 'kubernetes-monitoring'
  | 'application-observability'
  | 'synthetic-monitoring';

// Complete total orders (every RecommendedCardId appears once) so the sort is deterministic;
// gating means several entries are unreachable for a given solution, which is harmless.
// Exported for the completeness invariant test only — consumers go through orderCardsForSolution.
export const SOLUTION_CARD_PRIORITY: Record<SolutionId, readonly RecommendedCardId[]> = {
  // Infra affinity: K8s Monitoring turns the metrics already flowing into curated views.
  metrics: [
    'enable-logs',
    'enable-logs-k8s',
    'kubernetes-monitoring',
    'hosted-traces',
    'application-observability',
    'connect-metrics',
    'synthetic-monitoring',
  ],
  // Logs↔traces correlation is the classic next step from logs.
  logs: [
    'connect-metrics',
    'hosted-traces',
    'application-observability',
    'kubernetes-monitoring',
    'enable-logs',
    'enable-logs-k8s',
    'synthetic-monitoring',
  ],
  // Traces are the App Observability foundation.
  traces: [
    'application-observability',
    'connect-metrics',
    'enable-logs',
    'enable-logs-k8s',
    'kubernetes-monitoring',
    'hosted-traces',
    'synthetic-monitoring',
  ],
  kubernetes: [
    'enable-logs-k8s',
    'enable-logs',
    'hosted-traces',
    'application-observability',
    'connect-metrics',
    'kubernetes-monitoring',
    'synthetic-monitoring',
  ],
  // Black-box uptime affinity: infra-adjacent next steps first, own card last (matches kubernetes).
  synthetics: [
    'kubernetes-monitoring',
    'hosted-traces',
    'application-observability',
    'enable-logs',
    'enable-logs-k8s',
    'connect-metrics',
    'synthetic-monitoring',
  ],
};

/**
 * Reorder a settled selection for the solution the user is viewing. Membership NEVER changes:
 * the matrix's blocking rules (selectRecommendations) stay authoritative; a solution view only
 * changes which of the selected cards leads the carousel.
 */
export function orderCardsForSolution(cards: RecommendedCardId[], solution: SolutionId): RecommendedCardId[] {
  const priority = SOLUTION_CARD_PRIORITY[solution];
  return [...cards].sort((a, b) => priority.indexOf(a) - priority.indexOf(b));
}

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
  const { metrics, logs, traces, kubernetes, spanMetrics, synthetics } = state;
  // The core-signal short-circuit deliberately excludes spanMetrics and synthetics: they each gate one card.
  if (metrics === 'unknown' || logs === 'unknown' || traces === 'unknown' || kubernetes === 'unknown') {
    return { cards: [], baseRow: 'unknown' };
  }

  if (metrics === 'inactive') {
    // Empty orgs still get a full onboarding carousel: the three telemetry pillars.
    if (logs === 'inactive' && traces === 'inactive') {
      return { cards: ['connect-metrics', 'enable-logs', 'hosted-traces'], baseRow: 'empty' };
    }
    // Matrix "Logs-only" row: Metrics PRIMARY, Traces SECONDARY; partial telemetry without
    // metrics funnels to Metrics alone before anything else.
    if (logs === 'active' && traces === 'inactive') {
      return { cards: ['connect-metrics', 'hosted-traces'], baseRow: 'logs_only' };
    }
    return { cards: ['connect-metrics'], baseRow: 'partial_telemetry' };
  }

  // Synthetic Monitoring rides the Kubernetes rows and the metrics-only row; like spanMetrics
  // gating App O11y, only a definitive inactive shows the card.
  const syntheticMonitoring: RecommendedCardId[] = synthetics === 'inactive' ? ['synthetic-monitoring'] : [];

  if (logs === 'inactive') {
    // Logs is PRIMARY before any traces/k8s recommendation; the K8s row only changes the copy
    // (Helm values flag). The row's Traces cell is moot when traces are already active.
    return kubernetes === 'active'
      ? { cards: ['enable-logs-k8s', ...syntheticMonitoring], baseRow: 'k8s_no_logs' }
      : { cards: ['enable-logs', ...syntheticMonitoring], baseRow: 'metrics_only' };
  }

  if (traces === 'inactive') {
    // Distinct rows so Hosted Traces clicks segment by Kubernetes presence.
    return kubernetes === 'active'
      ? { cards: ['hosted-traces', ...syntheticMonitoring], baseRow: 'mlk_no_traces' }
      : { cards: ['hosted-traces', 'kubernetes-monitoring'], baseRow: 'ml_no_traces' };
  }

  // M+L+T (OTel starters): App Observability unless span metrics show it is already in use.
  const appO11y: RecommendedCardId[] = spanMetrics === 'inactive' ? ['application-observability'] : [];
  return kubernetes === 'active'
    ? { cards: appO11y, baseRow: 'fully_active' }
    : { cards: [...appO11y, 'kubernetes-monitoring'], baseRow: 'mlt' };
}
