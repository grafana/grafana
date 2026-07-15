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

/**
 * Runtime status for a panel, read from the live scene's data provider.
 * This is a side-channel returned by LIST_PANELS with `includeStatus: true`.
 * It is intentionally NOT part of the v2 DashboardSpec: these are transient
 * runtime values (query health, loaded frames), not saved dashboard state.
 */

/**
 * A single panel error. `message`/`refId`/`type` are a curated subset of
 * `@grafana/data`'s `DataQueryError` (the standard backend/query error shape);
 * `refId`/`type` are only set for query errors. `source` says where the error
 * came from, so callers can tell a failed query from a broken plugin without
 * parsing the message.
 */
export interface PanelRuntimeError {
  source: 'query' | 'plugin' | 'notice';
  message?: string;
  refId?: string;
  type?: string;
}

/** A non-error data-frame notice (`QueryResultMetaNotice`); error-severity notices are folded into `errors`. */
export interface PanelRuntimeNotice {
  severity: 'info' | 'warning';
  text: string;
}

export interface PanelRuntimeStatus {
  // Raw scene loading state. `isLoading` is a pure function of this, so it is not duplicated here.
  loadingState: LoadingState;
  // Not implied by loadingState: a Done panel can still carry errors (a query error or an
  // error-severity notice) or return no data, so these are reported explicitly.
  hasError: boolean;
  hasNoData: boolean;
  // Every panel error in one place: query errors (DataQueryError), error-severity
  // data-frame notices, and plugin-load failures.
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
