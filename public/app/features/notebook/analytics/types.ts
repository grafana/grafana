import { type EventProperty } from '@grafana/runtime/unstable';

// EventProperty interfaces for each notebook analytics event land here, one per event.

export interface NotebookLoadedProperties extends EventProperty {
  /** Identifier and join key for this notebook. Never the title, see the decisions doc. */
  notebookUid: string;
  /** Cells in the notebook, excluding the trailing empty editor block. */
  cellCount: number;
  /** The type of each cell in cellCount, in order. */
  cellsByType: string[];
  /** Panel cells among cellCount. */
  panelCount: number;
  /** Deduplicated datasource plugin IDs used by the notebook's panels. */
  datasourceTypes: string[];
  /** Cells among cellCount whose element the assistant wrote. */
  assistantCellCount: number;
  /** Whether the url opened the notebook in edit mode. A toggle later in the session does not change it. */
  mode: 'view' | 'edit';
  /** Whether this load came from the page's in-memory scene cache instead of a fetch. */
  wasCached: boolean;
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

export interface NotebookEditSessionEndedProperties extends EventProperty {
  /** Identifier and join key for this notebook. Empty for a session that ended before autosave created one. */
  notebookUid: string;
  /** How long the session ran, from entering edit mode to leaving it. */
  durationMs: number;
  /** Edits recorded during the session. An edit rolled back before it stood is not counted. */
  editCount: number;
  /** How the session ended. */
  endReason: NotebookEditSessionEndReason;
  /** Cells in the notebook when the session ended, excluding the trailing empty editor block. */
  cellCount: number;
  /** The type of each cell in cellCount, in order. */
  cellsByType: string[];
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

export interface NotebookNewStartedProperties extends EventProperty {
  /** Which surface the new notebook was started from. */
  source: NotebookEntryPoint;
}

export interface NotebookCreatedProperties extends EventProperty {
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
