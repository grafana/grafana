/**
 * Local types for the PromQL co-authoring prototype.
 * Prototype-only, branch-scoped — not part of the grafana-ui public API.
 */

/** Which demo journey the popover is currently driving. */
export enum Journey {
  /** Empty editor: describe a query in natural language, watch it build. */
  Scratch = 'scratch',
  /** Partial query already present: recognise it and suggest the completion. */
  MidQuery = 'mid-query',
  /** A generated query the user is now refining (entered by highlighting a preview). */
  Edit = 'edit',
}

/**
 * Editor operations the popover drives. Implemented by the controller, which
 * owns the Monaco instance. `writeTemp` inserts the query as a semi-transparent
 * preview (not yet committed to Explore); `commitTemp` solidifies + commits it;
 * `clearTemp` removes it; `insert` replaces + commits directly (no preview).
 */
export interface EditorActions {
  writeTemp(query: string): void;
  clearTemp(): void;
  commitTemp(): void;
  insert(query: string): void;
}

/** A single node in the visual query flow. */
export interface ChipModel {
  /** Text shown in the chip. */
  label: string;
  /** Op colour (metric/rate/sum/divide/topk) or empty for ghosts. */
  color: string;
  /** Optional series-count badge, e.g. "48" or "12+12". */
  count?: string;
  /** Ghost chips are dashed + pulsing — an unconfirmed AI suggestion. */
  ghost?: boolean;
}

/** One scripted stage of the popover animation. */
export interface Stage {
  /** Natural-language prompt text shown in the input row (scratch journey). */
  nl?: string;
  /** Show a blinking caret in the NL input. */
  nlCaret?: boolean;
  /** Placeholder visible (NL input empty). */
  nlEmpty?: boolean;
  /** Chips to render as the query flow, or null for none yet. */
  chips?: ChipModel[] | null;
  /** Small uppercase label above the flow, e.g. "Building flow". */
  flowLabel?: string;
  /** When true, show the suggested PromQL preview + Insert button. */
  suggest?: boolean;
  /** Guidance line at the bottom of the popover. */
  hint: string;
}

/** A per-step explanation used by the non-AI query-flow panel (journey 3). */
export interface StepModel {
  color: string;
  title: string;
  desc: string;
  /** Series count out of this step, e.g. "12 series". */
  out: string;
  /** Optional tip/warning/recommendation note. */
  note?: string;
  /** Colour of the note dot: warning (amber) vs recommendation (blue). */
  noteColor?: string;
}
