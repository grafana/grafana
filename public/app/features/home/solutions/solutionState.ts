import { type DataSourceInstanceListItem } from '@grafana/data';

import { withDeadline } from './probeUtils';

/** Hard ceiling on one signal's detection; past it the signal settles unknown. */
export const SIGNAL_BUDGET_MS = 30_000;

export type SignalStatus = 'active' | 'inactive' | 'unknown';

export interface SolutionState {
  metrics: SignalStatus;
  logs: SignalStatus;
  traces: SignalStatus;
  kubernetes: SignalStatus;
  /** Span metrics prove App Observability use. Unlike core signals, `unknown` does not blank recommendations. */
  spanMetrics: SignalStatus;
  /** Gates only the Synthetics card; like spanMetrics, 'unknown' never blanks recommendations. */
  synthetics: SignalStatus;
  /** Grafana Alerting routing into IRM. Gates only the IRM card; 'unknown' never blanks recommendations. */
  irm: SignalStatus;
}

/** The signals that pick a matrix row; any of them `unknown` blanks the recommendations. */
export const CORE_SIGNALS = ['metrics', 'logs', 'traces', 'kubernetes'] as const satisfies ReadonlyArray<
  keyof SolutionState
>;

/** A settled signal: whether data is flowing, and the datasource that proved it. */
export interface SignalDetection {
  status: SignalStatus;
  datasource: DataSourceInstanceListItem | null;
}

/**
 * A clean empty probe is inactive. Failures and timeouts are unknown and never reject. A capped,
 * batched scan (PROBE_BATCH_SIZE) settles inside the budget. Callers memoize detection so each
 * solution scans once per homepage visit. The budget releases the caller; it does not cancel the
 * scan.
 */
export async function detectSignal(probe: () => Promise<DataSourceInstanceListItem | null>): Promise<SignalDetection> {
  try {
    const datasource = await withDeadline(SIGNAL_BUDGET_MS, undefined, () => probe());
    return { status: datasource ? 'active' : 'inactive', datasource };
  } catch {
    return { status: 'unknown', datasource: null };
  }
}

/** Settles every signal; a rejection reads as unknown so one failing producer never blanks the snapshot. */
export async function settleSignals<K extends string>(
  signals: Record<K, Promise<SignalStatus>>
): Promise<Record<K, SignalStatus>>;
export async function settleSignals(
  signals: Record<string, Promise<SignalStatus>>
): Promise<Record<string, SignalStatus>> {
  const entries = await Promise.all(
    Object.entries(signals).map(async ([key, signal]) => {
      const status = await signal.catch(() => 'unknown' as const);
      return [key, status] as const;
    })
  );
  return Object.fromEntries(entries);
}
