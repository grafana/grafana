import { SOLUTION_IDS } from '../solutions/constants';
import { type SignalStatus, type SolutionState } from '../solutions/solutionState';

import {
  type BaseRow,
  orderCardsForSolution,
  type RecommendedCardId,
  selectRecommendations,
  SOLUTION_CARD_PRIORITY,
} from './solutionsMatrix';

function state(m: SignalStatus, l: SignalStatus, t: SignalStatus, k: SignalStatus): SolutionState {
  // spanMetrics/synthetics inactive = App Observability / Synthetic Monitoring not in use; cases override.
  return { metrics: m, logs: l, traces: t, kubernetes: k, spanMetrics: 'inactive', synthetics: 'inactive' };
}

const on = 'active' as const;
const off = 'inactive' as const;

describe('selectRecommendations', () => {
  // All 12 reachable core combinations (kubernetes ⇒ metrics removes 4 of 16).
  it.each<[SolutionState, RecommendedCardId[], BaseRow]>([
    [state(off, off, off, off), ['connect-metrics', 'enable-logs', 'hosted-traces'], 'empty'],
    [state(off, off, on, off), ['connect-metrics'], 'partial_telemetry'],
    [state(off, on, off, off), ['connect-metrics', 'hosted-traces'], 'logs_only'],
    [state(off, on, on, off), ['connect-metrics'], 'partial_telemetry'],
    [state(on, off, off, off), ['enable-logs', 'synthetic-monitoring'], 'metrics_only'],
    [state(on, off, on, off), ['enable-logs', 'synthetic-monitoring'], 'metrics_only'],
    [state(on, off, off, on), ['enable-logs-k8s', 'synthetic-monitoring'], 'k8s_no_logs'],
    [state(on, off, on, on), ['enable-logs-k8s', 'synthetic-monitoring'], 'k8s_no_logs'],
    [state(on, on, off, off), ['hosted-traces', 'kubernetes-monitoring'], 'ml_no_traces'],
    [state(on, on, off, on), ['hosted-traces', 'synthetic-monitoring'], 'mlk_no_traces'],
    [state(on, on, on, off), ['application-observability', 'kubernetes-monitoring'], 'mlt'],
    [state(on, on, on, on), ['application-observability'], 'fully_active'],
  ])('m=%s selects %s (%s)', (input, cards, baseRow) => {
    expect(selectRecommendations(input)).toEqual({ cards, baseRow });
  });

  // A single unknown core signal blanks the selection even when the settled signals would produce cards.
  it.each<Exclude<keyof SolutionState, 'spanMetrics' | 'synthetics'>>(['metrics', 'logs', 'traces', 'kubernetes'])(
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

  it('drops the Synthetic Monitoring card from its rows when synthetics is active', () => {
    expect(selectRecommendations({ ...state(on, off, off, on), synthetics: 'active' })).toEqual({
      cards: ['enable-logs-k8s'],
      baseRow: 'k8s_no_logs',
    });
    expect(selectRecommendations({ ...state(on, off, off, off), synthetics: 'active' })).toEqual({
      cards: ['enable-logs'],
      baseRow: 'metrics_only',
    });
    expect(selectRecommendations({ ...state(on, on, off, on), synthetics: 'active' })).toEqual({
      cards: ['hosted-traces'],
      baseRow: 'mlk_no_traces',
    });
  });

  it('fails the Synthetic Monitoring card toward hiding on an unknown synthetics probe, without blanking', () => {
    expect(selectRecommendations({ ...state(on, off, off, on), synthetics: 'unknown' })).toEqual({
      cards: ['enable-logs-k8s'],
      baseRow: 'k8s_no_logs',
    });
    expect(selectRecommendations({ ...state(on, on, off, on), synthetics: 'unknown' })).toEqual({
      cards: ['hosted-traces'],
      baseRow: 'mlk_no_traces',
    });
  });
});

describe('orderCardsForSolution', () => {
  const ALL_CARD_IDS: RecommendedCardId[] = [
    'connect-metrics',
    'enable-logs',
    'enable-logs-k8s',
    'hosted-traces',
    'kubernetes-monitoring',
    'application-observability',
    'synthetic-monitoring',
  ];

  it('leads ml_no_traces with K8s Monitoring for metrics and Hosted Traces for logs', () => {
    const { cards } = selectRecommendations(state(on, on, off, off));

    expect(orderCardsForSolution(cards, 'metrics')).toEqual(['kubernetes-monitoring', 'hosted-traces']);
    expect(orderCardsForSolution(cards, 'logs')).toEqual(['hosted-traces', 'kubernetes-monitoring']);
  });

  it('leads mlt with K8s Monitoring for metrics and App Observability for logs and traces', () => {
    const { cards } = selectRecommendations(state(on, on, on, off));

    expect(orderCardsForSolution(cards, 'metrics')).toEqual(['kubernetes-monitoring', 'application-observability']);
    expect(orderCardsForSolution(cards, 'logs')).toEqual(['application-observability', 'kubernetes-monitoring']);
    expect(orderCardsForSolution(cards, 'traces')).toEqual(['application-observability', 'kubernetes-monitoring']);
  });

  it('only reorders: every solution view yields a permutation of every reachable selection', () => {
    // All 12 reachable core combinations (kubernetes ⇒ metrics removes 4 of 16).
    const reachable: SolutionState[] = (['active', 'inactive'] as const).flatMap((m) =>
      (['active', 'inactive'] as const).flatMap((l) =>
        (['active', 'inactive'] as const).flatMap((t) =>
          (['active', 'inactive'] as const)
            .filter((k) => !(k === 'active' && m === 'inactive'))
            .map((k) => state(m, l, t, k))
        )
      )
    );
    expect(reachable).toHaveLength(12);

    for (const solutionState of reachable) {
      const { cards } = selectRecommendations(solutionState);
      for (const id of SOLUTION_IDS) {
        const ordered = orderCardsForSolution(cards, id);
        expect([...ordered].sort()).toEqual([...cards].sort());
      }
    }
  });

  it('holds a complete total order per solution: every card id exactly once', () => {
    for (const id of SOLUTION_IDS) {
      expect([...SOLUTION_CARD_PRIORITY[id]].sort()).toEqual([...ALL_CARD_IDS].sort());
    }
  });

  it('never mutates its input', () => {
    const cards: RecommendedCardId[] = ['hosted-traces', 'kubernetes-monitoring'];

    orderCardsForSolution(cards, 'metrics');

    expect(cards).toEqual(['hosted-traces', 'kubernetes-monitoring']);
  });
});
