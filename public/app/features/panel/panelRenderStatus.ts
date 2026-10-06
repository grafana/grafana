/**
 * The last draw result of panels that report one, for tools that cannot see the panel (the
 * Mutation API's GET_PANEL_RENDER_STATUS). A panel that draws in a way the host cannot observe,
 * like the Custom panel's sandboxed frame, registers a reporter and keeps its status current.
 *
 * Keyed by panel id. Several instances of one panel can be mounted at once (the dashboard and the
 * panel editor), so each id keeps a stack and the most recently registered instance answers.
 */

export type PanelRenderState = 'pending' | 'drawn' | 'error';

export interface PanelRenderStatus {
  panelId: number;
  pluginId: string;
  /** pending: no draw finished yet. drawn: the last draw finished. error: it failed or did not run. */
  state: PanelRenderState;
  /** True when the drawn data will not change (Done, Error or PartialResult). */
  final: boolean;
  /** The panel's data state at the last draw. */
  dataState?: string;
  /** Identifies the code or configuration the status is for, so a caller can skip a stale report. */
  digest?: string;
  error?: { kind: string; message: string };
  /** Problems reported during a draw that still finished, such as a blocked resource. */
  diagnostics?: string[];
  durationMs?: number;
  /** Elements in the drawing after the last draw. */
  nodeCount?: number;
  /** Epoch ms of the last change. */
  updatedAt: number;
}

export type PanelRenderStatusUpdate = Omit<PanelRenderStatus, 'panelId' | 'pluginId' | 'updatedAt'>;

export interface PanelRenderReporter {
  report(update: PanelRenderStatusUpdate): void;
  /** How to get a PNG data URL of the drawing, for panels the host page cannot capture itself. */
  setCapture(capture: (() => Promise<string>) | undefined): void;
  dispose(): void;
}

interface Entry {
  status: PanelRenderStatus;
  capture?: () => Promise<string>;
}

const entries = new Map<number, Entry[]>();

export function registerPanelRenderReporter(
  panelId: number,
  pluginId: string,
  now: () => number = Date.now
): PanelRenderReporter {
  const entry: Entry = { status: { panelId, pluginId, state: 'pending', final: false, updatedAt: now() } };
  const stack = entries.get(panelId) ?? [];
  stack.push(entry);
  entries.set(panelId, stack);
  let disposed = false;

  return {
    report(update) {
      if (!disposed) {
        entry.status = { ...update, panelId, pluginId, updatedAt: now() };
      }
    },
    setCapture(capture) {
      if (!disposed) {
        entry.capture = capture;
      }
    },
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      const current = entries.get(panelId);
      const index = current?.indexOf(entry) ?? -1;
      if (current && index >= 0) {
        current.splice(index, 1);
        if (current.length === 0) {
          entries.delete(panelId);
        }
      }
    },
  };
}

function currentEntry(panelId: number): Entry | undefined {
  const stack = entries.get(panelId);
  return stack?.[stack.length - 1];
}

export function getPanelRenderStatus(panelId: number): PanelRenderStatus | undefined {
  const status = currentEntry(panelId)?.status;
  return status && { ...status };
}

/** Undefined when the panel does not report, or reports without a capture. */
export function capturePanelRender(panelId: number): Promise<string> | undefined {
  return currentEntry(panelId)?.capture?.();
}

/** Ids of every panel with a mounted reporter. */
export function getReportingPanelIds(): number[] {
  return [...entries.keys()];
}
