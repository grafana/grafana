/**
 * The last draw result of panels that report one, for tools that cannot see the panel (the
 * Mutation API's GET_PANEL_RENDER_STATUS). A panel that draws in a way the host cannot observe,
 * like the Custom panel's sandboxed frame, registers a reporter and keeps its status current.
 *
 * Keyed by panel id. Several instances of one panel can be mounted at once: the dashboard and the
 * panel editor share the panel's key, so the most recently registered instance with a key answers
 * for it; repeat clones share the panel id but each has its own key, so each answers on its own.
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
  /** Where the last draw put its content in the panel, to spot a bad layout without an image. */
  layout?: PanelRenderLayout;
  /** True while the panel is out of view: it does not draw until it is scrolled into view. */
  paused?: boolean;
  /** The scene key of the mounted panel; repeat clones of one panel differ only here. */
  instanceKey?: string;
  /** Epoch ms of the last change. */
  updatedAt: number;
}

/** A box in panel pixels, from the panel's top left corner. */
export interface PanelRenderRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** An element label: tag, id and up to two classes, with its parent's (div.card > span.value). */
export type PanelRenderElementLabel = string;

export interface PanelRenderLayoutFinding<Sample> {
  /** Every match, even past the samples. */
  count: number;
  samples: Sample[];
}

/**
 * A bounded summary of the layout after a draw. Diagnostics only: it reads the drawing, it is not
 * a way to draw. Samples are capped; counts are exact for the elements looked at.
 */
export interface PanelRenderLayout {
  /** The panel area, in pixels. */
  width: number;
  height: number;
  /** Share of the panel area (0 to 1) covered by text, media and filled boxes smaller than half the panel. */
  coverage: number;
  /** The largest empty rectangles, each at least a tenth of the panel; share is of the panel area. */
  emptyRegions: Array<PanelRenderRect & { share: number }>;
  /** Outermost visible elements that reach past the panel edges. */
  overflowing: PanelRenderLayoutFinding<PanelRenderRect & { element: PanelRenderElementLabel; sides: string[] }>;
  /** Text cut by its own box or an ancestor with overflow hidden; visible is the share still shown. */
  clippedText: PanelRenderLayoutFinding<{
    element: PanelRenderElementLabel;
    text: string;
    visible: number;
    /** True when the cut is a text-overflow: ellipsis the code asked for. */
    ellipsis: boolean;
  }>;
  /** Text lines over other text lines, and in-flow sibling boxes over each other; area in px². */
  overlaps: PanelRenderLayoutFinding<{
    kind: 'text' | 'box';
    a: PanelRenderElementLabel;
    b: PanelRenderElementLabel;
    area: number;
    /** For text overlaps, an excerpt of each text. */
    aText?: string;
    bText?: string;
  }>;
  /** Elements looked at, and whether the drawing had more than the report looks at. */
  inspected: number;
  truncated: boolean;
  /** Time the report took inside the frame. */
  durationMs: number;
}

export type PanelRenderStatusUpdate = Omit<
  PanelRenderStatus,
  'panelId' | 'pluginId' | 'updatedAt' | 'paused' | 'instanceKey'
>;

/** The shape of one data frame the drawing received, so a caller can see what the code works with. */
export interface PanelRenderFrameSummary {
  refId?: string;
  name?: string;
  length: number;
  /** Set for frames from a -- Dashboard -- query: the panel they came from. */
  sourcePanelId?: number;
  sourcePanelTitle?: string;
  /** The refId of the source panel's query the frame came from. */
  sourceRefId?: string;
  fields: Array<{
    name: string;
    type: string;
    displayName: string;
    unit?: string;
    /** The last non-null value as the panel formats it, prefix and suffix included. */
    last?: string;
  }>;
  /** Fields left out of the summary. */
  omittedFields?: number;
}

export interface PanelRenderDataSummary {
  frames: PanelRenderFrameSummary[];
  /** Frames left out of the summary. */
  omittedFrames?: number;
}

export interface PanelRenderReporter {
  report(update: PanelRenderStatusUpdate): void;
  /** How to get a PNG data URL of the drawing, for panels the host page cannot capture itself. */
  setCapture(capture: (() => Promise<string>) | undefined): void;
  /** Marks the panel out of view (it skips draws) or back in view; the last report stays. */
  setPaused(paused: boolean): void;
  /** The shape of the data last sent to the drawing. */
  setData(data: PanelRenderDataSummary | undefined): void;
  dispose(): void;
}

interface Entry {
  status: PanelRenderStatus;
  capture?: () => Promise<string>;
  data?: PanelRenderDataSummary;
}

const entries = new Map<number, Entry[]>();

export function registerPanelRenderReporter(
  panelId: number,
  pluginId: string,
  now: () => number = Date.now,
  instanceKey?: string
): PanelRenderReporter {
  const identity = { panelId, pluginId, ...(instanceKey !== undefined && { instanceKey }) };
  const entry: Entry = { status: { ...identity, state: 'pending', final: false, updatedAt: now() } };
  const stack = entries.get(panelId) ?? [];
  stack.push(entry);
  entries.set(panelId, stack);
  let disposed = false;

  return {
    report(update) {
      if (!disposed) {
        const paused = entry.status.paused;
        entry.status = { ...update, ...identity, ...(paused && { paused }), updatedAt: now() };
      }
    },
    setData(data) {
      if (!disposed) {
        entry.data = data;
      }
    },
    setPaused(paused) {
      if (disposed || Boolean(entry.status.paused) === paused) {
        return;
      }
      const next: PanelRenderStatus = { ...entry.status, updatedAt: now() };
      if (paused) {
        next.paused = true;
      } else {
        delete next.paused;
      }
      entry.status = next;
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

/**
 * One status per mounted instance of the panel: the most recent registration for each instance
 * key, in registration order. Repeat clones each get one; the dashboard and the editor share one.
 */
export function getPanelRenderStatuses(panelId: number): PanelRenderStatus[] {
  return latestPerInstance(panelId).map((entry) => ({ ...entry.status }));
}

/** Undefined when the panel does not report, or reports without a capture. */
export function capturePanelRender(panelId: number, instanceKey?: string): Promise<string> | undefined {
  return findEntry(panelId, instanceKey)?.capture?.();
}

/** The shape of the data the panel last sent to its drawing, when it reports one. */
export function getPanelRenderData(panelId: number, instanceKey?: string): PanelRenderDataSummary | undefined {
  return findEntry(panelId, instanceKey)?.data;
}

function findEntry(panelId: number, instanceKey: string | undefined): Entry | undefined {
  return instanceKey === undefined
    ? currentEntry(panelId)
    : latestPerInstance(panelId).find((candidate) => candidate.status.instanceKey === instanceKey);
}

function latestPerInstance(panelId: number): Entry[] {
  const stack = entries.get(panelId) ?? [];
  const latest = new Map<string | undefined, Entry>();
  for (const entry of stack) {
    latest.delete(entry.status.instanceKey);
    latest.set(entry.status.instanceKey, entry);
  }
  return [...latest.values()];
}

/** Ids of every panel with a mounted reporter. */
export function getReportingPanelIds(): number[] {
  return [...entries.keys()];
}
