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
  /** Cells among cell_count whose element was authored by the assistant. */
  assistant_cell_count: number;
  /** Whether the page opened already in edit mode. */
  mode: 'view' | 'edit';
  /** Whether this load was served from the page's in-memory scene cache rather than fetched. */
  was_cached: boolean;
  /** Cells among cell_count that are not untouched empty markdown or an unconfigured panel. */
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
 * Where a notebook came from, shared by every event that has to name a surface. `NOTEBOOK_LIST` is
 * the blank route reached from the list's create button. `EXPLORE` and `DASHBOARD_PANEL` are the two
 * callers of the add-panel modal, which creates a notebook outright rather than opening a blank one,
 * so only `created` sends those. `ASSISTANT` and `WORKSPACE` are reserved for entry points that do
 * not exist yet, so nothing carries them.
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
