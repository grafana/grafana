/**
 * Dashboard Mutation API - Core Types
 *
 * Response types use v2beta1 schema types directly to stay in sync.
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
}

export interface MutationChange {
  path: string;
  previousValue: unknown;
  newValue: unknown;
}

export interface MutationClient {
  execute(mutation: MutationRequest): Promise<MutationResult>;
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
