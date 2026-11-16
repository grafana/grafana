import type { DataQuery, DataSourceApi, RestrictedGrafanaApisContextType } from '@grafana/data';
import { isRecord } from 'app/core/utils/isRecord';

/** UTF-16 offsets into the query text, with an exclusive end. `describe().text` must equal the editor's text. */
export interface QueryCoauthoringRange {
  from: number;
  to: number;
}

export type QueryCoauthoringHealth = 'unknown' | 'error' | 'no-data' | 'no-signal' | 'ok';

export type QueryCoauthoringPreviewOutcome = 'loading' | 'error' | 'no-data' | 'no-signal' | 'ok';

export interface QueryCoauthoringTarget {
  dashboardUid?: string;
  panelId: number;
  refId: string;
}

export interface QueryCoauthoringEntryRequest {
  target: QueryCoauthoringTarget;
  ranges: QueryCoauthoringRange[];
  intent: 'explain_or_modify' | 'debug';
  health: Record<string, QueryCoauthoringHealth>;
}

export interface QueryCoauthoringChange {
  refId: string;
  text: string;
}

export interface QueryCoauthoringDiff {
  refId: string;
  original: string;
  proposed: string;
  originalRanges: QueryCoauthoringRange[];
  proposedRanges: QueryCoauthoringRange[];
  editsOutsideFocus: boolean;
}

export interface QueryCoauthoringOption {
  changes: QueryCoauthoringChange[];
}

export interface QueryCoauthoringStagedOption {
  id: string;
  diffs: QueryCoauthoringDiff[];
  previewOutcome: QueryCoauthoringPreviewOutcome | null;
  warnings: string[];
  error?: string;
}

export type QueryCoauthoringStageResult =
  | { status: 'staged'; id: string; diffs: QueryCoauthoringDiff[] }
  | { status: 'invalid' | 'unchanged' | 'stale' | 'unsupported' };

export type QueryCoauthoringApplyResult =
  | { status: 'applied'; revision: number }
  | { status: 'aborted' | 'stale' | 'blocked' | 'closed' | 'invalid' | 'no_user_activation' };

export type QueryCoauthoringClosedReason = 'exit' | 'replaced' | 'left_panel_edit' | 'flag_off' | 'focus_removed';

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

export interface QueryCoauthoringSession {
  readonly version: 1;
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

export interface QueryCoauthoringAPI {
  readonly version: 1;
  onEnterRequested(listener: (request: QueryCoauthoringEntryRequest) => void): () => void;
  onResumeRequested(listener: (request: { sessionId: string }) => void): () => void;
  canEnter(
    target: QueryCoauthoringTarget
  ): { ok: true } | { ok: false; reason: 'not_in_panel_edit' | 'unsupported_datasource' | 'unknown_query' };
  /**
   * Rejects when `canEnter(target)` is not ok.
   * Consumers keep their own session types and validate the returned handle at runtime.
   */
  enter(target: QueryCoauthoringTarget): Promise<unknown>;
}

export interface QueryCoauthoringLanguageDescription {
  text: string;
  language: { id: string; displayName: string; guidance?: string[] };
  metadata?: Array<{ kind: string; name: string; attributes?: Record<string, string | string[]> }>;
}

export interface QueryCoauthoringTextChange {
  original: string;
  proposed: string;
  originalRanges: QueryCoauthoringRange[];
  proposedRanges: QueryCoauthoringRange[];
}

export type QueryCoauthoringPrepareResult<TQuery extends DataQuery = DataQuery> =
  | { status: 'ready'; query: TQuery; changes: QueryCoauthoringTextChange[] }
  | { status: 'rejected'; reason: 'invalid' | 'unchanged' };

export interface QueryCoauthoringLanguage<TQuery extends DataQuery = DataQuery> {
  readonly version: 1;
  getQuerySupport?(query: TQuery): { editable: boolean };
  describe(query: TQuery, options: { signal?: AbortSignal }): Promise<QueryCoauthoringLanguageDescription>;
  prepare(baseline: TQuery, text: string): QueryCoauthoringPrepareResult<TQuery>;
}

export interface QueryCoauthoringEditorSelection {
  ranges: QueryCoauthoringRange[];
  anchor: HTMLElement;
}

export interface QueryCoauthoringEditorHandle {
  readonly version: 1;
  getSelection(): QueryCoauthoringEditorSelection | null;
  subscribe(listener: () => void): () => void;
  showChanges?(changes: QueryCoauthoringTextChange[] | null): void;
}

export interface QueryCoauthoringEditorHost {
  readonly version: 1;
  register(handle: QueryCoauthoringEditorHandle): () => void;
  /** Called by the editor for the coauthoring shortcut, including when no text is selected. */
  invoke(): void;
}

export type DataSourceWithQueryCoauthoring<TQuery extends DataQuery = DataQuery> = DataSourceApi<TQuery> & {
  queryCoauthoring?: () => QueryCoauthoringLanguage<TQuery>;
};

export type QueryEditorPropsWithCoauthoring<TProps> = TProps & {
  queryCoauthoring?: QueryCoauthoringEditorHost;
};

export type RestrictedGrafanaApisWithQueryCoauthoring = RestrictedGrafanaApisContextType & {
  queryCoauthoring?: QueryCoauthoringAPI;
  queryCoauthoringV2?: QueryCoauthoringAPI2;
};

export function isQueryCoauthoringAPI(value: unknown): value is QueryCoauthoringAPI {
  return (
    isRecord(value) &&
    value.version === 1 &&
    typeof value.onEnterRequested === 'function' &&
    typeof value.onResumeRequested === 'function' &&
    typeof value.canEnter === 'function' &&
    typeof value.enter === 'function'
  );
}

export function isQueryCoauthoringLanguage(value: unknown): value is QueryCoauthoringLanguage {
  return (
    isRecord(value) &&
    value.version === 1 &&
    typeof value.describe === 'function' &&
    typeof value.prepare === 'function'
  );
}

export function isQueryCoauthoringEditorHost(value: unknown): value is QueryCoauthoringEditorHost {
  return (
    isRecord(value) && value.version === 1 && typeof value.register === 'function' && typeof value.invoke === 'function'
  );
}

export function isQueryCoauthoringEditorHandle(value: unknown): value is QueryCoauthoringEditorHandle {
  return (
    isRecord(value) &&
    value.version === 1 &&
    typeof value.getSelection === 'function' &&
    typeof value.subscribe === 'function' &&
    (value.showChanges === undefined || typeof value.showChanges === 'function')
  );
}

export function isQueryCoauthoringSession(value: unknown): value is QueryCoauthoringSession {
  return hasSessionMethods(value, 1);
}

function hasSessionMethods(value: unknown, version: 1 | 2): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    value.version === version &&
    isRecord(value.signal) &&
    typeof value.signal.aborted === 'boolean' &&
    typeof value.signal.addEventListener === 'function' &&
    typeof value.signal.removeEventListener === 'function' &&
    isRecord(value.closed) &&
    typeof value.closed.then === 'function' &&
    typeof value.closed.catch === 'function' &&
    typeof value.closed.finally === 'function' &&
    typeof value.getState === 'function' &&
    typeof value.subscribe === 'function' &&
    typeof value.stageProposal === 'function' &&
    typeof value.preview === 'function' &&
    typeof value.accept === 'function' &&
    typeof value.undo === 'function' &&
    typeof value.select === 'function' &&
    typeof value.exit === 'function'
  );
}

export type QueryCoauthoringFailure =
  | 'datasource_resolution_failed'
  | 'language_resolution_failed'
  | 'support_check_failed'
  | 'description_failed'
  | 'preparation_failed';

export type QueryCoauthoringUnsupported = 'missing_language' | 'unsupported_language_version';

export type QueryCoauthoringDescriptionResult =
  | { status: 'ready'; value: QueryCoauthoringLanguageDescription }
  | { status: 'unavailable'; reason: QueryCoauthoringUnsupported }
  | { status: 'failed'; reason: QueryCoauthoringFailure };

export type QueryCoauthoringEditability =
  | { kind: 'editable' | 'read_only' }
  | { kind: 'unknown'; reason: 'missing_query_support' | QueryCoauthoringFailure }
  | { kind: 'unsupported'; reason: QueryCoauthoringUnsupported };

export interface QueryCoauthoringQueryContext {
  refId: string;
  name?: string;
  dependencies: string[];
  editability: QueryCoauthoringEditability;
  description: QueryCoauthoringDescriptionResult;
}

export type QueryCoauthoringEntryBaseline = {
  refId: string;
  revision: number;
  contextGeneration: number;
  ranges: QueryCoauthoringRange[];
} & (
  | { status: 'ready'; text: string }
  | { status: 'unavailable'; reason: QueryCoauthoringUnsupported }
  | { status: 'failed'; reason: QueryCoauthoringFailure }
);

export interface QueryCoauthoringEntryRequest2 extends QueryCoauthoringEntryRequest {
  entryId: string;
  baseline: QueryCoauthoringEntryBaseline;
}

export type QueryCoauthoringProblem =
  | { scope: 'query'; refId: string; kind: 'error' | 'no-data'; message?: string }
  | { scope: 'panel'; kind: 'error'; message?: string };

export interface QueryCoauthoringState2 extends QueryCoauthoringState {
  contextGeneration: number;
  dependencies: Record<string, string[]>;
  problems: QueryCoauthoringProblem[];
}

export type QueryCoauthoringContextResult =
  | {
      status: 'ready';
      sessionId: string;
      revision: number;
      contextGeneration: number;
      queries: QueryCoauthoringQueryContext[];
      entry: QueryCoauthoringEntryBaseline & { matchesCurrentText: boolean | 'unknown' };
    }
  | { status: 'stale'; currentRevision: number; currentContextGeneration: number }
  | { status: 'aborted' | 'closed' };

export type QueryCoauthoringStageResult2 =
  | { status: 'staged'; id: string; diffs: QueryCoauthoringDiff[] }
  | { status: 'unchanged' | 'stale' | 'aborted' | 'closed' }
  | { status: 'invalid'; issue: { kind: 'invalid_text'; refId: string } | { kind: 'invalid_change'; refId?: string } }
  | { status: 'unsupported'; issue: { kind: QueryCoauthoringUnsupported; refId: string } }
  | { status: 'rejected'; issue: { kind: 'read_only' | 'unknown_editability' | 'entry_ranges_changed'; refId: string } }
  | { status: 'failed'; issue: { kind: QueryCoauthoringFailure; refId: string } };

export interface QueryCoauthoringSession2
  extends Omit<QueryCoauthoringSession, 'version' | 'getState' | 'subscribe' | 'stageProposal'> {
  readonly version: 2;
  getState(): QueryCoauthoringState2;
  subscribe(listener: (state: QueryCoauthoringState2) => void): () => void;
  getContext(options: { baseRevision: number; signal?: AbortSignal }): Promise<QueryCoauthoringContextResult>;
  stageProposal(
    proposal: QueryCoauthoringOption[],
    options: {
      baseRevision: number;
      baseContextGeneration: number;
      signal?: AbortSignal;
    }
  ): Promise<QueryCoauthoringStageResult2[]>;
}

export interface QueryCoauthoringAPI2 extends Omit<QueryCoauthoringAPI, 'version' | 'onEnterRequested' | 'enter'> {
  readonly version: 2;
  getAvailability(): { eligible: boolean };
  subscribeAvailability(listener: (value: { eligible: boolean }) => void): () => void;
  onEnterRequested(listener: (request: QueryCoauthoringEntryRequest2) => void): () => void;
  enter(target: QueryCoauthoringTarget, options: { entryId: string }): Promise<unknown>;
}

export function isQueryCoauthoringAPI2(value: unknown): value is QueryCoauthoringAPI2 {
  return (
    isRecord(value) &&
    value.version === 2 &&
    typeof value.getAvailability === 'function' &&
    typeof value.subscribeAvailability === 'function' &&
    typeof value.onEnterRequested === 'function' &&
    typeof value.onResumeRequested === 'function' &&
    typeof value.canEnter === 'function' &&
    typeof value.enter === 'function'
  );
}

export function isQueryCoauthoringSession2(value: unknown): value is QueryCoauthoringSession2 {
  return (
    isRecord(value) && value.version === 2 && hasSessionMethods(value, 2) && typeof value.getContext === 'function'
  );
}
