/**
 * Dashboard Mutation API - Core Types
 *
 * Response types use v2beta1 schema types.
 * Command-specific payload types are defined in their respective command files
 * and inferred from Zod schemas.
 */

import { type LoadingState } from '@grafana/data';
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

export interface PanelRuntimeError {
  // Where the error came from, so callers can tell a failed query from a broken plugin.
  source: 'query' | 'plugin' | 'notice';
  // A subset of `@grafana/data`'s `DataQueryError`; refId/type are set for query errors only.
  message?: string;
  refId?: string;
  type?: string;
}

/** A non-error data-frame notice; error-severity notices are folded into `errors`. */
export interface PanelRuntimeNotice {
  severity: 'info' | 'warning';
  text: string;
}

/** Panel runtime health from LIST_PANELS `includeStatus`; a side-channel, never part of the v2 DashboardSpec. */
export interface PanelRuntimeStatus {
  loadingState: LoadingState;
  // Reported explicitly because loadingState does not imply them: a Done panel can still error or have no data.
  hasError: boolean;
  hasNoData: boolean;
  errors?: PanelRuntimeError[];
  notices?: PanelRuntimeNotice[];
}

export interface FieldSchema {
  name: string;
  type: string;
  labels?: Record<string, string>;
}

export interface FrameSchema {
  name?: string;
  fields: FieldSchema[];
}

export interface PanelElementEntry {
  element: Element;
  layoutItem: LayoutItemKind;
  status?: PanelRuntimeStatus;
  dataSchema?: FrameSchema[];
}

export interface PanelElementsData {
  elements: PanelElementEntry[];
}
