/**
 * Dashboard Mutation API - Core Types
 *
 * Response types use v2beta1 schema types.
 * Command-specific payload types are defined in their respective command files
 * and inferred from Zod schemas.
 */

import type {
  AutoGridLayoutItemKind,
  Element,
  GridLayoutItemKind,
  VariableKind,
} from '@grafana/schema/dist/esm/schema/dashboard/v2';

export interface MutationRequest {
  type: string;
  payload: unknown;
}

export interface MutationResult {
  success: boolean;
  error?: string;
  changes: MutationChange[];
  warnings?: string[];
  data?: unknown;
  /**
   * Internal: callback to undo this mutation. Set by variable commands to wire
   * into the DashboardEditActionEvent undo/redo system. Underscore prefix signals
   * that this field is for internal infrastructure use only and must not be
   * forwarded to external callers.
   */
  _undo?: () => void;
  /**
   * Internal: human-readable description shown in the undo history UI.
   * Set alongside _undo by commands that support undo/redo.
   */
  _description?: string;
}

export interface MutationChange {
  path: string;
  previousValue: unknown;
  newValue: unknown;
}

export interface MutationClient {
  execute(mutation: MutationRequest): Promise<MutationResult>;
  getAvailableCommands(): string[];
}

export type LayoutItemKind = GridLayoutItemKind | AutoGridLayoutItemKind;

export interface PanelElementEntry {
  element: Element;
  layoutItem: LayoutItemKind;
}

export interface PanelElementsData {
  elements: PanelElementEntry[];
}

export interface ListVariablesData {
  variables: VariableKind[];
}
