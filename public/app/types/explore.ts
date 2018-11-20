import { Value } from 'slate';

import { RawTimeRange } from './series';

export interface CompletionItem {
  /**
   * The label of this completion item. By default
   * this is also the text that is inserted when selecting
   * this completion.
   */
  label: string;
  /**
   * The kind of this completion item. Based on the kind
   * an icon is chosen by the editor.
   */
  kind?: string;
  /**
   * A human-readable string with additional information
   * about this item, like type or symbol information.
   */
  detail?: string;
  /**
   * A human-readable string, can be Markdown, that represents a doc-comment.
   */
  documentation?: string;
  /**
   * A string that should be used when comparing this item
   * with other items. When `falsy` the `label` is used.
   */
  sortText?: string;
  /**
   * A string that should be used when filtering a set of
   * completion items. When `falsy` the `label` is used.
   */
  filterText?: string;
  /**
   * A string or snippet that should be inserted in a document when selecting
   * this completion. When `falsy` the `label` is used.
   */
  insertText?: string;
  /**
   * Delete number of characters before the caret position,
   * by default the letters from the beginning of the word.
   */
  deleteBackwards?: number;
  /**
   * Number of steps to move after the insertion, can be negative.
   */
  move?: number;
}

export interface CompletionItemGroup {
  /**
   * Label that will be displayed for all entries of this group.
   */
  label: string;
  /**
   * List of suggestions of this group.
   */
  items: CompletionItem[];
  /**
   * If true, match only by prefix (and not mid-word).
   */
  prefixMatch?: boolean;
  /**
   * If true, do not filter items in this group based on the search.
   */
  skipFilter?: boolean;
  /**
   * If true, do not sort items.
   */
  skipSort?: boolean;
}

interface ExploreDatasource {
  value: string;
  label: string;
}

export interface HistoryItem {
  ts: number;
  query: string;
}

export abstract class LanguageProvider {
  datasource: any;
  request: (url) => Promise<any>;
  /**
   * Returns startTask that resolves with a task list when main syntax is loaded.
   * Task list consists of secondary promises that load more detailed language features.
   */
  start: () => Promise<any[]>;
  startTask?: Promise<any[]>;
}

export interface TypeaheadInput {
  text: string;
  prefix: string;
  wrapperClasses: string[];
  labelKey?: string;
  value?: Value;
}

export interface TypeaheadOutput {
  context?: string;
  refresher?: Promise<{}>;
  suggestions: CompletionItemGroup[];
}

export interface Query {
  query: string;
  key?: string;
}

export interface QueryFix {
  type: string;
  label: string;
  action?: QueryFixAction;
}

export interface QueryFixAction {
  type: string;
  query?: string;
  preventSubmit?: boolean;
}

export interface QueryHint {
  type: string;
  label: string;
  fix?: QueryFix;
}

export interface QueryTransaction {
  id: string;
  done: boolean;
  error?: string | JSX.Element;
  hints?: QueryHint[];
  latency: number;
  options: any;
  query: string;
  result?: any; // Table model / Timeseries[] / Logs
  resultType: ResultType;
  rowIndex: number;
}

export interface TextMatch {
  text: string;
  start: number;
  length: number;
  end: number;
}

export interface ExploreState {
  StartPage?: any;
  datasource: any;
  datasourceError: any;
  datasourceLoading: boolean | null;
  datasourceMissing: boolean;
  datasourceName?: string;
  exploreDatasources: ExploreDatasource[];
  graphRange: RawTimeRange;
  history: HistoryItem[];
  /**
   * Initial rows of queries to push down the tree.
   * Modifications do not end up here, but in `this.queryExpressions`.
   * The only way to reset a query is to change its `key`.
   */
  queries: Query[];
  /**
   * Hints gathered for the query row.
   */
  queryTransactions: QueryTransaction[];
  range: RawTimeRange;
  showingGraph: boolean;
  showingLogs: boolean;
  showingStartPage?: boolean;
  showingTable: boolean;
  supportsGraph: boolean | null;
  supportsLogs: boolean | null;
  supportsTable: boolean | null;
}

export interface ExploreUrlState {
  datasource: string;
  queries: Query[];
  range: RawTimeRange;
}

export type ResultType = 'Graph' | 'Logs' | 'Table';
