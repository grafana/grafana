import {
  type BaseRow,
  type RecommendedCardId,
  selectRecommendations,
  type SignalStatus,
  type SolutionState,
} from './solutionsMatrix';

function state(m: SignalStatus, l: SignalStatus, t: SignalStatus, k: SignalStatus): SolutionState {
  // spanMetrics inactive = App Observability not in use; specific cases override it.
  return { metrics: m, logs: l, traces: t, kubernetes: k, spanMetrics: 'inactive' };
}

const on = 'active' as const;
const off = 'inactive' as const;

describe('selectRecommendations', () => {
  // All 12 reachable core combinations (kubernetes ⇒ metrics removes 4 of 16).
  it.each<[SolutionState, RecommendedCardId[], BaseRow]>([
    [state(off, off, off, off), ['connect-metrics', 'enable-logs', 'hosted-traces'], 'empty'],
    [state(off, off, on, off), ['connect-metrics'], 'partial_telemetry'],
    [state(off, on, off, off), ['connect-metrics'], 'logs_only'],
    [state(off, on, on, off), ['connect-metrics'], 'partial_telemetry'],
    [state(on, off, off, off), ['enable-logs'], 'metrics_only'],
    [state(on, off, on, off), ['enable-logs'], 'metrics_only'],
    [state(on, off, off, on), ['enable-logs-k8s'], 'k8s_no_logs'],
    [state(on, off, on, on), ['enable-logs-k8s'], 'k8s_no_logs'],
    [state(on, on, off, off), ['hosted-traces', 'kubernetes-monitoring'], 'ml_no_traces'],
    [state(on, on, off, on), ['hosted-traces'], 'mlk_no_traces'],
    [state(on, on, on, off), ['application-observability', 'kubernetes-monitoring'], 'mlt'],
    [state(on, on, on, on), ['application-observability'], 'fully_active'],
  ])('m=%s selects %s (%s)', (input, cards, baseRow) => {
    expect(selectRecommendations(input)).toEqual({ cards, baseRow });
  });

  // A single unknown core signal blanks the selection even when the settled signals would produce cards.
  it.each<Exclude<keyof SolutionState, 'spanMetrics'>>(['metrics', 'logs', 'traces', 'kubernetes'])(
    'short-circuits to no cards when %s is unknown',
    (signal) => {
      const cardProducing = state(on, on, off, off);
      expect(selectRecommendations({ ...cardProducing, [signal]: 'unknown' })).toEqual({
        cards: [],
        baseRow: 'unknown',
      });
    }
  );

  it('drops the App Observability card when span metrics show it is already in use', () => {
    expect(selectRecommendations({ ...state(on, on, on, off), spanMetrics: 'active' })).toEqual({
      cards: ['kubernetes-monitoring'],
      baseRow: 'mlt',
    });
    expect(selectRecommendations({ ...state(on, on, on, on), spanMetrics: 'active' })).toEqual({
      cards: [],
      baseRow: 'fully_active',
    });
  });

  it('fails the App Observability card toward hiding on an unknown span-metrics probe, without blanking', () => {
    expect(selectRecommendations({ ...state(on, on, on, off), spanMetrics: 'unknown' })).toEqual({
      cards: ['kubernetes-monitoring'],
      baseRow: 'mlt',
    });
  });

  it('ignores span metrics outside the M+L+T rows', () => {
    expect(selectRecommendations({ ...state(on, on, off, off), spanMetrics: 'active' })).toEqual({
      cards: ['hosted-traces', 'kubernetes-monitoring'],
      baseRow: 'ml_no_traces',
    });
  });
});
