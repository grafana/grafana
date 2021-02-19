import { Value } from 'slate';
import { Editor } from '@grafana/slate-react';

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

export enum CompletionItemKind {
  GroupTitle = 'GroupTitle',
}

export interface CompletionItem {
  /**
   * The label of this completion item. By default
   * this is also the text that is inserted when selecting
   * this completion.
   */
  label: string;

  /**
   * The kind of this completion item. An icon is chosen
   * by the editor based on the kind.
   */
  kind?: CompletionItemKind | string;

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

export interface TypeaheadOutput {
  context?: string;
  suggestions: CompletionItemGroup[];
}

export interface TypeaheadInput {
  text: string;
  prefix: string;
  wrapperClasses: string[];
  labelKey?: string;
  value?: Value;
  editor?: Editor;
}

export interface SuggestionsState {
  groupedItems: CompletionItemGroup[];
  typeaheadPrefix: string;
  typeaheadContext: string;
  typeaheadText: string;
}
