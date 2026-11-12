import type { RestrictedGrafanaApisContextType } from '../context/plugins/RestrictedGrafanaApis';

import type { DataSourceApi, DataSourceJsonData } from './datasource';
import type { DataQuery } from './query';

/**
 * Offsets in query text, with an exclusive end.
 *
 * @alpha
 */
export interface QueryCoauthoringRange {
  from: number;
  to: number;
}

/** @alpha */
export type QueryCoauthoringHealth = 'unknown' | 'error' | 'no-data' | 'no-signal' | 'ok';

/** @alpha */
export type QueryCoauthoringPreviewOutcome = 'loading' | 'error' | 'no-data' | 'no-signal' | 'ok';

/** @alpha */
export interface QueryCoauthoringTarget {
  dashboardUid?: string;
  panelId: number;
  refId: string;
}

/** @alpha */
export interface QueryCoauthoringEntryRequest {
  target: QueryCoauthoringTarget;
  ranges: QueryCoauthoringRange[];
  intent: 'explain_or_modify' | 'debug';
  health: Record<string, QueryCoauthoringHealth>;
}

/** @alpha */
export interface QueryCoauthoringChange {
  refId: string;
  text: string;
}

/** @alpha */
export interface QueryCoauthoringDiff {
  refId: string;
  original: string;
  proposed: string;
  originalRanges: QueryCoauthoringRange[];
  proposedRanges: QueryCoauthoringRange[];
  editsOutsideFocus: boolean;
}

/** @alpha */
export interface QueryCoauthoringOption {
  changes: QueryCoauthoringChange[];
}

/** @alpha */
export interface QueryCoauthoringStagedOption {
  id: string;
  diffs: QueryCoauthoringDiff[];
  previewOutcome: QueryCoauthoringPreviewOutcome | null;
  warnings: string[];
  error?: string;
}

/** @alpha */
export type QueryCoauthoringStageResult =
  | { status: 'staged'; id: string; diffs: QueryCoauthoringDiff[] }
  | { status: 'invalid' | 'unchanged' | 'stale' | 'unsupported' };

/** @alpha */
export type QueryCoauthoringApplyResult =
  | { status: 'applied'; revision: number }
  | { status: 'aborted' | 'stale' | 'blocked' | 'closed' | 'invalid' | 'no_user_activation' };

/** @alpha */
export type QueryCoauthoringClosedReason = 'exit' | 'replaced' | 'left_panel_edit' | 'flag_off' | 'focus_removed';

/** @alpha */
export interface QueryCoauthoringState {
  sessionId: string;
  revision: number;
  step: 'review' | 'apply';
  queries: DataQuery[];
  health: Record<string, QueryCoauthoringHealth>;
  proposal: QueryCoauthoringStagedOption[] | null;
  previewedOption: string | 'original';
  canUndo: boolean;
  stale: boolean;
}

/** @alpha */
export interface QueryCoauthoringSession {
  readonly signal: AbortSignal;
  readonly closed: Promise<QueryCoauthoringClosedReason>;
  getState(): QueryCoauthoringState;
  subscribe(listener: (state: QueryCoauthoringState) => void): () => void;
  /** Results correspond to the input options in order. A proposal contains at most three options. */
  stageProposal(
    proposal: QueryCoauthoringOption[],
    options: { baseRevision: number; signal?: AbortSignal }
  ): Promise<QueryCoauthoringStageResult[]>;
  preview(optionId: string | 'original'): { ok: true } | { ok: false; reason: 'stale' };
  /** Accept and undo require transient user activation. */
  accept(
    optionId: string,
    options: { baseRevision: number; signal?: AbortSignal }
  ): Promise<QueryCoauthoringApplyResult>;
  undo(options: { signal?: AbortSignal }): Promise<QueryCoauthoringApplyResult>;
  select(refId: string): void;
  exit(): void;
}

/** @alpha */
export interface QueryCoauthoringAPI {
  readonly version: 1;
  onEnterRequested(listener: (request: QueryCoauthoringEntryRequest) => void): () => void;
  onResumeRequested(listener: (request: { sessionId: string }) => void): () => void;
  canEnter(
    target: QueryCoauthoringTarget
  ): { ok: true } | { ok: false; reason: 'not_in_panel_edit' | 'unsupported_datasource' | 'unknown_query' };
  enter(target: QueryCoauthoringTarget): Promise<QueryCoauthoringSession>;
}

/** @alpha */
export interface QueryCoauthoringLanguageDescription {
  text: string;
  language: { id: string; displayName: string; guidance?: string[] };
  metadata?: Array<{ kind: string; name: string; attributes?: Record<string, string | string[]> }>;
}

/** @alpha */
export interface QueryCoauthoringTextChange {
  original: string;
  proposed: string;
  originalRanges: QueryCoauthoringRange[];
  proposedRanges: QueryCoauthoringRange[];
}

/** @alpha */
export type QueryCoauthoringPrepareResult<TQuery extends DataQuery = DataQuery> =
  | { status: 'ready'; query: TQuery; changes: QueryCoauthoringTextChange[] }
  | { status: 'rejected'; reason: 'invalid' | 'unchanged' };

/** @alpha */
export interface QueryCoauthoringLanguage<TQuery extends DataQuery = DataQuery> {
  readonly version: 1;
  describe(query: TQuery, options: { signal?: AbortSignal }): Promise<QueryCoauthoringLanguageDescription>;
  prepare(baseline: TQuery, text: string): QueryCoauthoringPrepareResult<TQuery>;
}

/** @alpha */
export interface QueryCoauthoringEditorSelection {
  ranges: QueryCoauthoringRange[];
  anchor: HTMLElement;
}

/** @alpha */
export interface QueryCoauthoringEditorHandle {
  getSelection(): QueryCoauthoringEditorSelection | null;
  subscribe(listener: () => void): () => void;
  showChanges?(changes: QueryCoauthoringTextChange[] | null): void;
}

/** @alpha */
export interface QueryCoauthoringEditorHost {
  register(handle: QueryCoauthoringEditorHandle): () => void;
  /** Called by the editor for the coauthoring shortcut, including when no text is selected. */
  invoke(): void;
}

/** @alpha */
export type DataSourceWithQueryCoauthoring<
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData,
> = DataSourceApi<TQuery, TOptions> & {
  queryCoauthoring?: () => QueryCoauthoringLanguage<TQuery>;
};

/** @alpha */
export type QueryEditorPropsWithCoauthoring<TProps> = TProps & {
  queryCoauthoring?: QueryCoauthoringEditorHost;
};

/** @alpha */
export type RestrictedGrafanaApisWithQueryCoauthoring = RestrictedGrafanaApisContextType & {
  queryCoauthoring?: QueryCoauthoringAPI;
};
