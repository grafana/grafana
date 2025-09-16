import { Value } from 'slate';
import { Editor } from 'slate-react';

import { SearchFunctionType } from '../utils/searchFunctions';

/**
 * @internal
 */
export type SearchFunction = (items: CompletionItem[], prefix: string) => CompletionItem[];

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
   * @deprecated use searchFunctionType instead
   */
  prefixMatch?: boolean;

  /**
   * Function type used to create auto-complete list
   * @alpha
   */
  searchFunctionType?: SearchFunctionType;

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

/**
 * @internal
 */
export type HighlightPart = {
  start: number;
  end: number;
};

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
   * @deprecated use sortValue instead
   */
  sortText?: string;

  /**
   * A string or number that should be used when comparing this
   * item with other items. When `undefined` then `label` is used.
   * @alpha
   */
  sortValue?: string | number;

  /**
   * Parts of the label to be highlighted
   * @internal
   */
  highlightParts?: HighlightPart[];

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
