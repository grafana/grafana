/**
 * Dashboard Mutation API - Core Types
 *
 * Response types use v2beta1 schema types.
 * Command-specific payload types are defined in their respective command files
 * and inferred from Zod schemas.
 */

import type { AutoGridLayoutItemKind, Element, GridLayoutItemKind } from '@grafana/schema/dist/esm/schema/dashboard/v2';

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
   * True when the targeted object is currently write-locked. The agent should
   * wait and retry. Absent / false means the mutation was either applied or
   * failed for a non-lock reason.
   */
  locked?: boolean;
}

interface MutationChange {
  path: string;
  previousValue: unknown;
  newValue: unknown;
}

export interface MutationClient {
  execute(mutation: MutationRequest): Promise<MutationResult>;
  getAvailableCommands(): string[];
}

type LayoutItemKind = GridLayoutItemKind | AutoGridLayoutItemKind;

export interface PanelElementEntry {
  element: Element;
  layoutItem: LayoutItemKind;
}

export interface PanelElementsData {
  elements: PanelElementEntry[];
}
