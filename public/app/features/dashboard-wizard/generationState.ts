/**
 * Tiny app-level store for the wizard's pending dashboard generation.
 *
 * The wizard modal closes as soon as generation starts, so the generation
 * itself is owned by an app-level host component (DashboardGenerationHost)
 * that outlives the modal. The wizard publishes a request here; the host
 * picks it up and runs the assistant's headless dashboard builder, which
 * builds the dashboard in the live scene while the host's overlay blocks
 * interaction — in the new-dashboard editor for fresh builds, or in place
 * for "improve this dashboard" runs.
 *
 * The wizard can also announce a *likely* upcoming generation (prewarm) as
 * soon as it opens: the host then mounts the assistant's builder without a
 * prompt so it can pre-create the chat session the build will use, shaving
 * those round trips off the wait behind the overlay.
 *
 * After a successful build the store holds a 'done' phase so the host can
 * show follow-up actions (continue refining in the assistant, rate the
 * result) until the user dismisses them.
 */

export interface DashboardGenerationRequest {
  /** The full dashboard-building request handed to the assistant. */
  prompt: string;
  /** Origin identifier reported to the assistant. */
  origin: string;
  /** 'new' builds a fresh dashboard; 'current' improves the one that is open. */
  target: 'new' | 'current';
}

export interface DashboardGenerationOutcome {
  /** The agent's 1-2 sentence summary of what it built or changed. */
  summary: string;
  origin: string;
  target: 'new' | 'current';
  /** Opens the build's chat session in the assistant sidebar, when offered. */
  openInAssistant?: () => void;
}

export type DashboardGenerationPhase =
  | { status: 'idle' }
  | { status: 'prewarm'; origin: string }
  | { status: 'active'; request: DashboardGenerationRequest }
  | { status: 'done'; outcome: DashboardGenerationOutcome };

const IDLE: DashboardGenerationPhase = { status: 'idle' };

let phase: DashboardGenerationPhase = IDLE;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

/** Announce that a generation is likely coming so the host can warm up. */
export function prewarmDashboardGeneration(origin: string) {
  // A lingering 'done' bar from the previous build gives way to the new run.
  if (phase.status === 'active' || phase.status === 'prewarm') {
    return;
  }
  phase = { status: 'prewarm', origin };
  notify();
}

/** Undo a prewarm that never turned into a generation. No-op mid-build. */
export function cancelDashboardGenerationPrewarm() {
  if (phase.status !== 'prewarm') {
    return;
  }
  phase = IDLE;
  notify();
}

export function startDashboardGeneration(request: DashboardGenerationRequest) {
  phase = { status: 'active', request };
  notify();
}

/** Transition a finished build to its follow-up state (success bar). */
export function completeDashboardGeneration(outcome: DashboardGenerationOutcome) {
  phase = { status: 'done', outcome };
  notify();
}

export function clearDashboardGeneration() {
  phase = IDLE;
  notify();
}

export function getDashboardGenerationPhase(): DashboardGenerationPhase {
  return phase;
}

export function subscribeToDashboardGeneration(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
