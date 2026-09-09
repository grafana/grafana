import { type EventProperty } from '@grafana/runtime/unstable';

// EventProperty interfaces for each notebook analytics event land here, one per event.

export interface NotebookLoadedProperties extends EventProperty {
  /** Identifier and join key for this notebook. Never the title, see the decisions doc. */
  notebook_uid: string;
  /** Cells in the notebook, excluding the trailing empty editor block. */
  cell_count: number;
  /** The type of each cell in cell_count, in order. */
  cells_by_type: string[];
  /** Panel cells among cell_count. */
  panel_count: number;
  /** Deduplicated datasource plugin IDs used by the notebook's panels. */
  datasource_types: string[];
  /** Cells among cell_count whose element the assistant wrote. */
  assistant_cell_count: number;
  /** Whether the url opened the notebook in edit mode. A toggle later in the session does not change it. */
  mode: 'view' | 'edit';
  /** Whether this load came from the page's in-memory scene cache instead of a fetch. */
  was_cached: boolean;
  /** Cells among cell_count with real content: markdown someone typed in, or a configured panel. */
  meaningful_cell_count: number;
  /** Markdown cells among cell_count. */
  text_cell_count: number;
  /** Code cells among cell_count. */
  code_cell_count: number;
  /** Panels among panel_count that have at least one real query configured. */
  configured_panel_count: number;
  /** Distinct datasource types among datasource_types. */
  datasource_count: number;
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

export interface NotebookNewStartedProperties extends EventProperty {
  /** Which surface the new notebook was started from. */
  source: NotebookEntryPoint;
}

export interface NotebookCreatedProperties extends EventProperty {
  /** Identifier and join key for this notebook. */
  notebook_uid: string;
  /** Which surface the notebook was created from. */
  source: NotebookEntryPoint;
  /** Cells in the notebook at the moment it was created, excluding the trailing empty editor block. */
  cell_count: number;
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
  notebook_uid: string;
  /** Which surface the delete was confirmed on. */
  source: NotebookDeleteSource;
}
