import { type DataQuery } from '@grafana/schema';

// Private to the paired PanelEditNext and Prometheus experiment.
// Promote a generalized interface before adding another datasource adapter.

export interface QueryEditorCoauthoringRangeV1 {
  from: number;
  to: number;
}

export interface QueryEditorCoauthoringMetadataV1 {
  kind: string;
  name: string;
  attributes?: Record<string, string | string[]>;
}

export interface QueryEditorCoauthoringLanguageV1 {
  id: string;
  displayName: string;
  guidance?: string[];
}

export interface QueryEditorCoauthoringContextV1 {
  revision: string;
  query: string;
  focusRanges: QueryEditorCoauthoringRangeV1[];
  language: QueryEditorCoauthoringLanguageV1;
  metadata: QueryEditorCoauthoringMetadataV1[];
}

export interface QueryEditorCoauthoringChangeV1 {
  id: string;
  original: string;
  proposed: string;
  kind?: string;
  focus?: 'inside' | 'outside' | 'mixed';
}

export type QueryEditorCoauthoringSnapshotV1 =
  | { mode: 'hidden' }
  | { mode: 'selection'; portalTarget: HTMLElement }
  | { mode: 'invoked'; invocationId: string; portalTarget: HTMLElement };

export interface QueryEditorCoauthoringInvocationV1<TQuery extends DataQuery = DataQuery> {
  baseline: TQuery;
  context: QueryEditorCoauthoringContextV1;
}

export type QueryEditorCoauthoringProposalResultV1<TQuery extends DataQuery = DataQuery> =
  | {
      status: 'ready';
      query: TQuery;
      changes: QueryEditorCoauthoringChangeV1[];
    }
  | { status: 'rejected'; reason: 'invalid' | 'unchanged' | 'stale' };

export interface QueryEditorCoauthoringAdapterV1<TQuery extends DataQuery = DataQuery> {
  getSnapshot(): QueryEditorCoauthoringSnapshotV1;
  subscribe(listener: VoidFunction): VoidFunction;
  invoke(): void;
  readInvocation(invocationId: string): Promise<QueryEditorCoauthoringInvocationV1<TQuery>>;
  prepareProposal(invocationId: string, source: string): QueryEditorCoauthoringProposalResultV1<TQuery>;
  dismiss(): void;
}

export interface QueryEditorCoauthoringRegistrationV1<TQuery extends DataQuery = DataQuery> {
  register(adapter: QueryEditorCoauthoringAdapterV1<TQuery>): VoidFunction;
}

export interface InternalQueryEditorCoauthoringPropsV1 {
  unstable_queryEditorCoauthoringV1?: QueryEditorCoauthoringRegistrationV1;
}
