/**
 * Tiny app-level store for the wizard's pending dashboard generation.
 *
 * The wizard modal closes as soon as generation starts, so the generation
 * itself is owned by an app-level host component (DashboardGenerationHost)
 * that outlives the modal. The wizard publishes a request here; the host
 * picks it up and runs the assistant's headless dashboard builder, which
 * builds the dashboard in the live scene — in the new-dashboard editor for
 * fresh builds, or in place for "improve this dashboard" runs. The build's
 * conversation opens in the assistant sidebar while a dashboard edit lock
 * (dim overlay + progress pill) blocks manual edits until the build is done.
 *
 * The wizard can also announce a *likely* upcoming generation (prewarm) as
 * soon as it opens: the host then mounts the assistant's builder without a
 * prompt so it can pre-create the chat session the build will use, shaving
 * those round trips off the wait.
 */

export interface DashboardGenerationRequest {
  /** The full dashboard-building request handed to the assistant. */
  prompt: string;
  /**
   * Short user-facing text (the user's own wizard prompt and choices) shown
   * as their message in the build conversation. The full `prompt` then
   * reaches the agent as hidden context instead of being displayed. When
   * unset — or with an older assistant plugin that predates the prop — the
   * full `prompt` is shown as the message.
   */
  displayPrompt?: string;
  /** Origin identifier reported to the assistant. */
  origin: string;
  /** 'new' builds a fresh dashboard; 'current' improves the one that is open. */
  target: 'new' | 'current';
  /** How many automatic post-build repair passes have run (0/undefined for the original build). */
  repairAttempt?: number;
}

export type DashboardGenerationPhase =
  | { status: 'idle' }
  | { status: 'prewarm'; origin: string }
  | { status: 'active'; request: DashboardGenerationRequest };

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
