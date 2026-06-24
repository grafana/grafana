import type { Completion, CompletionContext, CompletionResult, CompletionSource } from '@codemirror/autocomplete';
import { type Extension } from '@codemirror/state';

export type CodeMirrorCompletion = Completion;
export type CodeMirrorCompletionContext = CompletionContext;
export type CodeMirrorCompletionResult = CompletionResult;
export type CodeMirrorCompletionSource = CompletionSource;

export type CodeMirrorExtension = Extension;

export type CodeMirrorCompletionMode = 'override' | 'merge';

export type CodeMirrorEditorLanguage = 'json' | 'sql';

/**
 * SQL dialect used for parsing and syntax highlighting when `language` is `'sql'`.
 * - `'standard'` (default) — ANSI SQL, where identifiers are quoted with double quotes.
 * - `'mysql'` — MySQL, where identifiers are quoted with backticks.
 */
export type CodeMirrorSqlDialect = 'standard' | 'mysql';

export interface CodeMirrorEditorProps {
  /**
   * The current editor contents.
   */
  value: string;
  /**
   * Syntax highlighting and language-aware behavior to enable.
   */
  language?: CodeMirrorEditorLanguage;
  /**
   * SQL dialect to parse with when `language` is `'sql'`. Defaults to `'standard'`.
   * Ignored for non-SQL languages.
   */
  sqlDialect?: CodeMirrorSqlDialect;
  /**
   * Editor height, such as `'200px'` or `'100%'`.
   */
  height?: string;
  /**
   * Called whenever the editor contents change.
   */
  onChange: (value: string) => void;
  /**
   * Accessible label applied to the editor input.
   */
  'aria-label'?: string;
  /**
   * Accessible label reference applied to the editor input.
   */
  'aria-labelledby'?: string;
  /**
   * Autocomplete sources. When provided, enables autocompletion with the given sources.
   */
  completionSources?: readonly CodeMirrorCompletionSource[];
  /**
   * Controls how `completionSources` integrate with language-default completions:
   * - `'merge'` (default) — add the sources alongside any language defaults.
   * - `'override'` — replace any language-default completions with just these sources.
   */
  completionMode?: CodeMirrorCompletionMode;
  /**
   * Additional CodeMirror extensions to layer on top of the defaults.
   * Use this for linting, custom keymaps, themes, etc.
   */
  extensions?: CodeMirrorExtension[];
}
