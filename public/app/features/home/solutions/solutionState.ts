import { type DataSourceInstanceListItem } from '@grafana/data';

import { withTimeout } from './probeUtils';

export type SignalStatus = 'active' | 'inactive' | 'unknown';

export interface SolutionState {
  metrics: SignalStatus;
  logs: SignalStatus;
  traces: SignalStatus;
  kubernetes: SignalStatus;
  /** Span metrics prove App Observability use. Unlike core signals, `unknown` does not blank recommendations. */
  spanMetrics: SignalStatus;
}

/** A settled signal: whether data is flowing, and the datasource that proved it. */
export interface SignalDetection {
  status: SignalStatus;
  datasource: DataSourceInstanceListItem | null;
}

// Hard ceiling per signal; one parallel scan (3s health filter + 10s probes) settles well inside it.
const SIGNAL_BUDGET_MS = 30_000;

/**
 * A clean empty probe is inactive. Failures and timeouts are unknown and never reject. Callers
 * memoize detection so each solution scans once per homepage visit.
 */
export async function detectSignal(probe: () => Promise<DataSourceInstanceListItem | null>): Promise<SignalDetection> {
  try {
    const datasource = await withTimeout(probe(), SIGNAL_BUDGET_MS);
    return { status: datasource ? 'active' : 'inactive', datasource };
  } catch {
    return { status: 'unknown', datasource: null };
  }
}
