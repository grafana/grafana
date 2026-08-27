/**
 * Deprecated Slate-based query editor surfaces.
 *
 * @packageDocumentation
 */

/** @deprecated Migrate to `QueryInput`. */
export { QueryField, type QueryFieldProps } from './components/QueryField/QueryField';
/** @deprecated Slate typeahead types are being removed. Migrate to CodeMirror. */
export type { TypeaheadOutput, TypeaheadInput, SuggestionsState } from './types/completion';
/** @deprecated Migrate to CodeMirror. */
export { SCHEMA, makeFragment, makeValue } from './utils/slate';
/** @deprecated Migrate to CodeMirror. */
export { BracesPlugin } from './slate-plugins/braces';
/** @deprecated Migrate to CodeMirror. */
export { ClearPlugin } from './slate-plugins/clear';
/** @deprecated Migrate to CodeMirror. */
export { ClipboardPlugin } from './slate-plugins/clipboard';
/** @deprecated Migrate to CodeMirror. */
export { IndentationPlugin } from './slate-plugins/indentation';
/** @deprecated Migrate to CodeMirror. */
export { NewlinePlugin } from './slate-plugins/newline';
/** @deprecated Migrate to CodeMirror. */
export { RunnerPlugin } from './slate-plugins/runner';
/** @deprecated Migrate to CodeMirror. */
export { SelectionShortcutsPlugin } from './slate-plugins/selection_shortcuts';
/** @deprecated Migrate to CodeMirror. */
export { SlatePrism, flattenTokens, type Token } from './slate-plugins/slate-prism';
/** @deprecated Migrate to CodeMirror. */
export { SuggestionsPlugin } from './slate-plugins/suggestions';
