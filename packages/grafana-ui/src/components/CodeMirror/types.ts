import type { Completion, CompletionContext, CompletionResult, CompletionSource } from '@codemirror/autocomplete';
import { type EditorState, type Extension } from '@codemirror/state';
import { type BasicSetupOptions } from '@uiw/react-codemirror';
import { type ReactNode } from 'react';

import { type VariableSuggestion } from '@grafana/data';

import { type CODE_MIRROR_LANGUAGES } from './languages';

export type CodeMirrorCompletion = Completion;
export type CodeMirrorCompletionContext = CompletionContext;
export type CodeMirrorCompletionResult = CompletionResult;
export type CodeMirrorCompletionSource = CompletionSource;

/**
 * Exported only from `@grafana/ui/internal`, for Grafana core. Plugins can't build
 * extensions that Grafana's copy of CodeMirror accepts.
 */
export type CodeMirrorExtension = Extension;

export type CodeMirrorCompletionMode = 'override' | 'merge';

/**
 * Basic setup features that can be turned off. Each one is on unless set to `false`.
 */
export interface CodeMirrorBasicSetupOptions {
  /** Line numbers in the gutter. */
  lineNumbers?: boolean;
  /** Highlights the gutter next to the line with the cursor. */
  highlightActiveLineGutter?: boolean;
  /** Code folding markers in the gutter. */
  foldGutter?: boolean;
  /** Shows where dragged text will be dropped. */
  dropCursor?: boolean;
  /** Allows more than one selection at a time. */
  allowMultipleSelections?: boolean;
  /** Re-indents a line while typing, where the language supports it. */
  indentOnInput?: boolean;
  /** Highlights the bracket that matches the one next to the cursor. */
  bracketMatching?: boolean;
  /** Inserts closing brackets and quotes automatically. */
  closeBrackets?: boolean;
  /**
   * Autocompletion. Passing `completionSources` or `variableSuggestions` turns
   * it back on, and in the default merge mode that includes the language's own
   * completions.
   */
  autocompletion?: boolean;
  /** Alt-drag rectangular selection. */
  rectangularSelection?: boolean;
  /** Highlights the line with the cursor. */
  highlightActiveLine?: boolean;
  /** Highlights other occurrences of the selected text. */
  highlightSelectionMatches?: boolean;
  /** Undo and redo history. */
  history?: boolean;
}

/**
 * `true` (the default) enables the full basic setup, `false` disables all of
 * it, and an options object turns off individual features.
 */
export type CodeMirrorBasicSetup = boolean | CodeMirrorBasicSetupOptions;

export type CodeMirrorEditorLanguage = keyof typeof CODE_MIRROR_LANGUAGES;

export interface CodeMirrorDiffEditorProps {
  original: string;
  modified: string;
  language?: CodeMirrorEditorLanguage;
  /** Editor height, such as `'200px'` or `'100%'`. */
  height?: string;
  /** Show deleted and inserted lines in a single pane. Defaults to false. */
  inline?: boolean;
  /** Show line numbers. Defaults to true. */
  lineNumbers?: boolean;
}

/**
 * SQL dialect used for syntax highlighting and keyword completion when
 * `language` is `'sql'`. Maps to the corresponding dialect from
 * `@codemirror/lang-sql`. Defaults to `'standardSql'`.
 */
export type CodeMirrorSqlDialect = 'standardSql' | 'mySql';

/** CSS properties, or nested selectors, applied to one theme selector. */
export interface CodeMirrorStyle {
  [propertyOrSelector: string]: string | number | CodeMirrorStyle | null;
}

/**
 * Styles merged into Grafana's editor theme, keyed by CodeMirror selector.
 * `&` is the editor root, for example `{ '&': { backgroundColor: 'transparent' } }`.
 */
export type CodeMirrorThemeOverrides = Record<string, CodeMirrorStyle>;

/**
 * A single parameter within a function signature, such as `decimals: number`.
 */
export interface SignatureParameter {
  /**
   * Display label for the parameter, for example `decimals: number`.
   */
  label: string;
  /**
   * Optional human-readable description of the parameter.
   */
  documentation?: string;
}

/**
 * A callable signature, such as `round(value: number, decimals: number): number`.
 *
 * The pieces are kept structured (rather than a single pre-formatted string) so
 * the tooltip can render and highlight them without having to parse a label.
 */
export interface SignatureInformation {
  /**
   * Function name shown before the parameter list.
   */
  name: string;
  /**
   * Ordered list of parameters used to highlight the active argument.
   */
  parameters: SignatureParameter[];
  /**
   * Optional return type shown after the parameter list.
   */
  returnType?: string;
  /**
   * Optional description of the function.
   */
  documentation?: string;
}

/**
 * The signature help returned by a provider for the current cursor position.
 */
export interface SignatureHelp {
  /**
   * Candidate signatures. Overloads can supply more than one.
   */
  signatures: SignatureInformation[];
  /**
   * Index into `signatures` of the signature to display.
   */
  activeSignature: number;
  /**
   * Index of the parameter the cursor is currently on.
   */
  activeParameter: number;
}

/**
 * Computes signature help for the cursor position, or `null` when none applies.
 */
export type SignatureHelpProvider = (state: EditorState, pos: number) => SignatureHelp | null;

/** How a suggestion is presented in the completion list. */
export interface VariableCompletionDisplay {
  label: string;
  detail?: string;
}

export interface VariableCompletionOptions {
  /**
   * Characters besides `$` that open the popup. They are separators rather than
   * part of the reference, so they are preserved: the replaced range starts
   * after them. `['=']` for a URL query string.
   */
  separators?: string[];
  /**
   * Text inserted when an option is accepted. Defaults to `${value}`. Override
   * to add a format suffix, for example `${value:queryparam}` inside a URL.
   */
  getInsertText?: (suggestion: VariableSuggestion) => string;
  /**
   * Label and detail shown in the list. Defaults to the suggestion's own label
   * with its origin as the detail.
   */
  toDisplay?: (suggestion: VariableSuggestion) => VariableCompletionDisplay;
}

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
   * SQL dialect to use when `language` is `'sql'`. Controls dialect-specific
   * syntax highlighting and keyword completion. Defaults to `'standardSql'`.
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
   * Called with the current editor contents when the editor loses focus.
   */
  onBlur?: (value: string) => void;
  /**
   * Called with the current editor contents when Ctrl/Cmd+S is pressed while
   * focused. The browser's default save action is always prevented, even when
   * this callback is omitted. The caller is responsible for persistence.
   */
  onSave?: (value: string) => void;
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
   * Define the sources outside the component or memoize them: a new source
   * reconfigures the editor.
   */
  completionSources?: readonly CodeMirrorCompletionSource[];
  /**
   * Controls how `completionSources` and `variableSuggestions` integrate with
   * language-default completions:
   * - `'merge'` (default) — add them alongside any language defaults.
   * - `'override'` — replace any language-default completions with just these.
   */
  completionMode?: CodeMirrorCompletionMode;
  /**
   * When `true`, a typed space opens the completion popup as an explicit
   * request. Suits a language where a space starts a new clause and the
   * suggestions are keywords or identifiers, as after `SELECT ` in SQL.
   *
   * Leave it off (the default) for prose. A source is free to answer an explicit
   * request with its whole list — the variable source does, so that Ctrl+Space
   * offers every variable — and binding that to the space bar would open the
   * popup on every word.
   */
  completeOnSpace?: boolean;
  /**
   * Grafana variables offered by autocompletion. Typing `$` opens the list, and
   * accepting an option inserts a complete reference such as `${name}`.
   * Memoize the list: a list holding different suggestion objects reconfigures
   * the editor.
   */
  variableSuggestions?: readonly VariableSuggestion[];
  /**
   * Customizes how `variableSuggestions` open, what they insert, and how they
   * are listed. Define the options outside the component or memoize them: a new
   * object reconfigures the editor.
   */
  variableCompletionOptions?: VariableCompletionOptions;
  /**
   * Shows a signature tooltip while the cursor is inside a function call. The
   * provider returns the signatures for the cursor position, or `null` outside a
   * call. Keep the provider stable between renders: a new one reconfigures the
   * editor.
   */
  signatureHelp?: SignatureHelpProvider;
  /**
   * Text shown while the editor is empty.
   */
  placeholder?: string;
  /**
   * Toggles for CodeMirror's bundled "basic setup" extensions. Defaults to the
   * full setup (line numbers, gutters, bracket closing, etc.). Pass `false` or a
   * partial options object to opt features out — e.g. for a single-line input.
   */
  basicSetup?: CodeMirrorBasicSetup;
  /**
   * Styles merged into Grafana's editor theme once the editor loads. Each
   * selector keeps Grafana's defaults unless a property is overridden. Define the
   * object outside the component or memoize it: a new object reconfigures the
   * editor.
   */
  theme?: CodeMirrorThemeOverrides;
  /**
   * When `true` (default), Tab indents the content (suited to a multi-line code
   * editor). Pass `false` for single-line inputs so Tab moves focus to the next
   * element instead of being captured as indentation (avoids a keyboard trap).
   */
  indentWithTab?: boolean;
  /**
   * Rejects all edits while keeping the text selectable.
   */
  readOnly?: boolean;
  /**
   * Wraps long lines instead of scrolling horizontally.
   */
  lineWrapping?: boolean;
  /**
   * Rendered while the editor bundle is being lazily loaded. Defaults to a
   * loading placeholder; pass a styled preview of the content to avoid a
   * visual flash when the editor appears.
   */
  loadingFallback?: ReactNode;
}

/**
 * Editor props for Grafana core and `@grafana/ui` internals, exported only from
 * `@grafana/ui/internal`. Extensions must come from Grafana's own copy of
 * CodeMirror, which plugins don't have.
 */
export interface CodeMirrorEditorSetupProps
  extends Omit<CodeMirrorEditorProps, 'theme' | 'basicSetup' | 'loadingFallback'> {
  /** Extensions layered on top of the editor's defaults. */
  extensions?: CodeMirrorExtension[];
  /** Style overrides merged into Grafana's theme, or a theme extension that replaces it. */
  theme?: CodeMirrorThemeOverrides | CodeMirrorExtension;
  basicSetup?: boolean | BasicSetupOptions;
}
