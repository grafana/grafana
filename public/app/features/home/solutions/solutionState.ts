import { type DataSourceInstanceListItem } from '@grafana/data';

import { withDeadline } from './probeUtils';
import { type SolutionId } from './types';

/** Hard ceiling on one signal's detection; past it the signal settles unknown. */
export const SIGNAL_BUDGET_MS = 30_000;

export type SignalStatus = 'active' | 'inactive' | 'unknown';

/** Every solution's settled signal, keyed by solution id. */
export type SolutionState = Record<SolutionId, SignalStatus>;

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
