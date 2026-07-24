import {
  type BaseRow,
  type RecommendedCardId,
  selectRecommendations,
  type SignalStatus,
  type SolutionState,
} from './solutionsMatrix';

function state(m: SignalStatus, l: SignalStatus, t: SignalStatus, k: SignalStatus): SolutionState {
  return { metrics: m, logs: l, traces: t, kubernetes: k };
}

const on = 'active' as const;
const off = 'inactive' as const;

describe('selectRecommendations', () => {
  // All 12 reachable combinations (kubernetes ⇒ metrics removes 4 of 16).
  it.each<[SolutionState, RecommendedCardId[], BaseRow]>([
    [state(off, off, off, off), ['connect-metrics', 'enable-logs', 'hosted-traces'], 'empty'],
    [state(off, off, on, off), [], 'partial_telemetry'],
    [state(off, on, off, off), [], 'logs_only'],
    [state(off, on, on, off), [], 'partial_telemetry'],
    [state(on, off, off, off), ['enable-logs'], 'metrics_only'],
    [state(on, off, on, off), ['enable-logs'], 'metrics_only'],
    [state(on, off, off, on), ['enable-logs-k8s'], 'k8s_no_logs'],
    [state(on, off, on, on), ['enable-logs-k8s'], 'k8s_no_logs'],
    [state(on, on, off, off), ['hosted-traces', 'kubernetes-monitoring'], 'ml_no_traces'],
    [state(on, on, off, on), ['hosted-traces'], 'mlk_no_traces'],
    [state(on, on, on, off), ['kubernetes-monitoring'], 'mlt'],
    [state(on, on, on, on), [], 'fully_active'],
  ])('m=%s selects %s (%s)', (input, cards, baseRow) => {
    expect(selectRecommendations(input)).toEqual({ cards, baseRow });
  });

  // A single unknown signal blanks the selection even when the settled signals would produce cards.
  it.each<keyof SolutionState>(['metrics', 'logs', 'traces', 'kubernetes'])(
    'short-circuits to no cards when %s is unknown',
    (signal) => {
      const cardProducing = state(on, on, off, off);
      expect(selectRecommendations({ ...cardProducing, [signal]: 'unknown' })).toEqual({
        cards: [],
        baseRow: 'unknown',
      });
    }
  );
});
