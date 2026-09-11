import { type EventProperty } from '@grafana/runtime/unstable';

// EventProperty interfaces for each notebook analytics event land here, one per event, plus the
// property groups that several events send. A group is shared when one reader in shape.ts computes
// it in one go and every event that sends it means the same thing by it, so the wording is written
// once. A property whose meaning changes per event, such as notebookUid or source, stays declared on
// each event: the per-event caveat is the only thing those docs carry.
//
// The groups extend EventProperty like the events do, which the define-feature-events lint rule asks
// of every interface in here. That is also what lets a reader in shape.ts return the group directly.

/** What a notebook held when the event fired, as readNotebookShape computes it. */
export interface NotebookShape extends EventProperty {
  /** Cells in the notebook, excluding the trailing empty editor block. */
  cellCount: number;
  /** Panel cells among cellCount. */
  panelCount: number;
  /** Deduplicated datasource plugin IDs used by the notebook's panels. */
  datasourceTypes: string[];
  /** Cells among cellCount whose element the assistant wrote. */
  assistantCellCount: number;
  /** Cells among cellCount with real content: markdown someone typed in, or a configured panel. */
  nonEmptyCellCount: number;
  /** Markdown cells among cellCount. */
  textCellCount: number;
  /** Code cells among cellCount. */
  codeCellCount: number;
  /** Panels among panelCount that have at least one real query configured. */
  configuredPanelCount: number;
  /** Distinct datasource types among datasourceTypes. */
  datasourceCount: number;
}

/** What the panel being added says about itself, as readAddedPanelShape reads it off the spec. */
export interface AddedPanelShape extends EventProperty {
  /** The panel's visualization plugin ID. Empty when only a library panel reference was stored. */
  panelType: string;
  /** Deduplicated datasource plugin IDs across the panel's queries. */
  datasourceTypes: string[];
  /** Queries on the panel, including the ones that are hidden. */
  queryCount: number;
}

/**
 * Everything an event says about the panel being added: what the spec can answer, plus the one thing
 * it cannot. The dashboard inlines a loaded library panel before it is serialized, so the element
 * stops saying that it came from the library and the caller has to pass that in.
 */
interface AddedPanelProperties extends EventProperty, AddedPanelShape {
  /**
   * Whether the panel came from the library. The notebook stores it inlined, so it stops following
   * later library edits.
   */
  isLibraryPanel: boolean;
}

export interface NotebookLoadedProperties extends EventProperty, NotebookShape {
  /** Identifier and join key for this notebook. Never the title, see the decisions doc. */
  notebookUid: string;
  /** Whether the url opened the notebook in edit mode. A toggle later in the session does not change it. */
  mode: 'view' | 'edit';
  /** Whether this load came from the page's in-memory scene cache instead of a fetch. */
  wasCached: boolean;
}

/**
 * The surface a notebook came from, for every event that has to name one. `EXPLORE` and
 * `DASHBOARD_PANEL` are the two callers of the add-panel modal, which creates a notebook outright
 * instead of opening a blank one, so only `created` sends them. Nothing sends `ASSISTANT` or
 * `WORKSPACE` yet.
 */
export const NOTEBOOK_ENTRY_POINT = {
  NOTEBOOK_LIST: 'notebook_list',
  EXPLORE: 'explore',
  DASHBOARD_PANEL: 'dashboard_panel',
  ASSISTANT: 'assistant',
  WORKSPACE: 'workspace',
} as const;

export type NotebookEntryPoint = (typeof NOTEBOOK_ENTRY_POINT)[keyof typeof NOTEBOOK_ENTRY_POINT];

/**
 * How an edit session began. `TOGGLE` is the Edit control inside an open notebook. `NAVIGATION` is
 * an arrival at `?edit=true`, such as the list's Edit action, a pasted link, or a reload. `NEW` is
 * a notebook with no uid yet. It wins over the other two: a notebook that does not exist yet is
 * the more useful fact.
 *
 * Nothing sends an assistant value. The assistant writes cells without entering edit mode.
 */
export const NOTEBOOK_EDIT_SESSION_SOURCE = {
  TOGGLE: 'toggle',
  NAVIGATION: 'navigation',
  NEW: 'new',
} as const;

export type NotebookEditSessionSource =
  (typeof NOTEBOOK_EDIT_SESSION_SOURCE)[keyof typeof NOTEBOOK_EDIT_SESSION_SOURCE];

export interface NotebookEditSessionStartedProperties extends EventProperty {
  /** Identifier and join key for this notebook. Empty for a notebook that has no uid yet. */
  notebookUid: string;
  /** How this edit session began. */
  source: NotebookEditSessionSource;
}

/**
 * How an edit session ended. `TOGGLE` covers the Edit control turning edit mode off and the url
 * losing `?edit=true` while the notebook stays open. `NAVIGATION` is the notebook page itself
 * being torn down while a session was still open, such as navigating away or closing the tab.
 */
export const NOTEBOOK_EDIT_SESSION_END_REASON = {
  TOGGLE: 'toggle',
  NAVIGATION: 'navigation',
} as const;

export type NotebookEditSessionEndReason =
  (typeof NOTEBOOK_EDIT_SESSION_END_REASON)[keyof typeof NOTEBOOK_EDIT_SESSION_END_REASON];

export interface NotebookEditSessionEndedProperties extends EventProperty, NotebookShape {
  /** Identifier and join key for this notebook. Empty for a session that ended before autosave created one. */
  notebookUid: string;
  /** How long the session ran, from entering edit mode to leaving it. */
  durationMs: number;
  /** Edits recorded during the session. An edit rolled back before it stood is not counted. */
  editCount: number;
  /** Cells inserted during the session, by any gesture. Counts an insert that was later undone. */
  cellsAdded: number;
  /** Cells deleted during the session. Counts a delete that was later undone. */
  cellsRemoved: number;
  /** Cells reordered during the session. */
  cellsMoved: number;
  /** Whether the time range moved during the session, by any control. */
  timeRangeChanged: boolean;
  /** How the session ended. */
  endReason: NotebookEditSessionEndReason;
}

export interface NotebookNewStartedProperties extends EventProperty {
  /** Which surface the new notebook was started from. */
  source: NotebookEntryPoint;
}

export interface NotebookCreatedProperties extends EventProperty, Partial<AddedPanelProperties> {
  /** Identifier and join key for this notebook. */
  notebookUid: string;
  /** Which surface the notebook was created from. */
  source: NotebookEntryPoint;
  /** Cells in the notebook at the moment it was created, excluding the trailing empty editor block. */
  cellCount: number;
}

/**
 * The surface a delete was confirmed on. `NOTEBOOK_LIST` is spelled as it is in
 * `NOTEBOOK_ENTRY_POINT`, so one page reads the same across events. The two lists still differ:
 * explore can create a notebook but not delete one, and a toolbar can delete one but not create it.
 */
export const NOTEBOOK_DELETE_SOURCE = {
  NOTEBOOK_LIST: 'notebook_list',
  NOTEBOOK_TOOLBAR: 'notebook_toolbar',
} as const;

export type NotebookDeleteSource = (typeof NOTEBOOK_DELETE_SOURCE)[keyof typeof NOTEBOOK_DELETE_SOURCE];

export interface NotebookDeletedProperties extends EventProperty {
  /**
   * Identifier and join key for this notebook. The last `loaded` for this uid gives its size, and the
   * `created` for this uid gives how long it survived.
   */
  notebookUid: string;
  /** Which surface the delete was confirmed on. */
  source: NotebookDeleteSource;
}

/**
 * Why an autosave attempt failed. `build_failed` means autosave could not assemble the spec, so it
 * sent no request. `write_failed` means the request failed, either the create or the update. That
 * covers every write failure today, because nothing yet tells a conflict apart from the rest.
 */
export const NOTEBOOK_AUTOSAVE_FAILED_REASON = {
  BUILD_FAILED: 'build_failed',
  WRITE_FAILED: 'write_failed',
} as const;

export type NotebookAutosaveFailedReason =
  (typeof NOTEBOOK_AUTOSAVE_FAILED_REASON)[keyof typeof NOTEBOOK_AUTOSAVE_FAILED_REASON];

/**
 * A cell added through the "Add to notebook" option. For a cell added inside an editing session, the
 * session counts it on `edit_session_ended` instead.
 *
 * No cell type: this option only ever appends a panel, so the value would be the same every time.
 */
export interface NotebookCellAddedFromAddToNotebookProperties extends EventProperty, AddedPanelProperties {
  /** Identifier and join key for this notebook. */
  notebookUid: string;
  /** Which surface the panel was sent from. */
  source: NotebookEntryPoint;
  /** Where the panel landed, counting from 0. Doubles as the notebook's size before the add. */
  position: number;
}

export interface NotebookAutosaveFailedProperties extends EventProperty {
  /** Identifier and join key for this notebook. Empty for a notebook that has no uid yet. */
  notebookUid: string;
  /** Why the attempt failed. */
  reason: NotebookAutosaveFailedReason;
  /** Failures in a row for this notebook since the last save that landed. */
  attempt: number;
}

/** Where the panel was headed: a notebook the user picked, or one the same submit would create. */
export const NOTEBOOK_ADD_TARGET = {
  NEW: 'new',
  EXISTING: 'existing',
} as const;

export type NotebookAddTarget = (typeof NOTEBOOK_ADD_TARGET)[keyof typeof NOTEBOOK_ADD_TARGET];

/**
 * Why an "Add to notebook" attempt failed. `build_failed` means the panel could not be turned into
 * a spec, so nothing was sent. `conflict` means someone else changed the notebook first, which is
 * the one failure a retry fixes. `write_failed` is every other failed request. `build_failed` and
 * `write_failed` are spelled as they are in `NOTEBOOK_AUTOSAVE_FAILED_REASON`, so both write paths
 * read the same across events.
 */
export const NOTEBOOK_ADD_FAILED_REASON = {
  BUILD_FAILED: 'build_failed',
  CONFLICT: 'conflict',
  WRITE_FAILED: 'write_failed',
} as const;

export type NotebookAddFailedReason = (typeof NOTEBOOK_ADD_FAILED_REASON)[keyof typeof NOTEBOOK_ADD_FAILED_REASON];

export interface NotebookAddFailedProperties extends EventProperty {
  /** Identifier and join key for the target notebook. Empty when the submit was creating one. */
  notebookUid: string;
  /** Which surface the panel was sent from. */
  source: NotebookEntryPoint;
  /** Whether the panel was headed for a new notebook or one that already existed. */
  target: NotebookAddTarget;
  /** Why the attempt failed. */
  reason: NotebookAddFailedReason;
}
