import type { Completion, CompletionContext, CompletionResult, CompletionSource } from '@codemirror/autocomplete';
import { type EditorState, type Extension } from '@codemirror/state';
import { type BasicSetupOptions } from '@uiw/react-codemirror';
import { type ReactNode } from 'react';

export type CodeMirrorCompletion = Completion;
export type CodeMirrorCompletionContext = CompletionContext;
export type CodeMirrorCompletionResult = CompletionResult;
export type CodeMirrorCompletionSource = CompletionSource;

export type CodeMirrorExtension = Extension;

export type CodeMirrorCompletionMode = 'override' | 'merge';

/**
 * Toggles for CodeMirror's bundled "basic setup" extensions (line numbers,
 * gutters, bracket closing, default keymaps, etc.). Pass `false` to disable all
 * of them, or an object to disable individual features.
 */
export type CodeMirrorBasicSetup = boolean | BasicSetupOptions;

export type CodeMirrorEditorLanguage = 'go' | 'html' | 'json' | 'markdown' | 'sql' | 'typescript' | 'xml' | 'yaml';

/**
 * SQL dialect used for syntax highlighting and keyword completion when
 * `language` is `'sql'`. Maps to the corresponding dialect from
 * `@codemirror/lang-sql`. Defaults to `'standardSql'`.
 */
export type CodeMirrorSqlDialect = 'standardSql' | 'mySql';

/**
 * A CodeMirror theme: either a theme extension (e.g. from `EditorView.theme`)
 * or one of CodeMirror's built-in keywords.
 */
export type CodeMirrorEditorTheme = CodeMirrorExtension | 'light' | 'dark' | 'none';

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
  /**
   * Toggles for CodeMirror's bundled "basic setup" extensions. Defaults to the
   * full setup (line numbers, gutters, bracket closing, etc.). Pass `false` or a
   * partial options object to opt features out — e.g. for a single-line input.
   */
  basicSetup?: CodeMirrorBasicSetup;
  /**
   * Replaces the editor's default VS Code theme. A layered theme extension
   * cannot reliably override the default (the default's style module is mounted
   * last and wins the CSS cascade for equal-specificity rules), so theming the
   * editor differently must go through this prop. Defaults to the VS Code theme
   * (dark or light) when omitted.
   */
  theme?: CodeMirrorEditorTheme;
  /**
   * When `true` (default), Tab indents the content (suited to a multi-line code
   * editor). Pass `false` for single-line inputs so Tab moves focus to the next
   * element instead of being captured as indentation (avoids a keyboard trap).
   */
  indentWithTab?: boolean;
  /**
   * Renders the editor as a non-editable, read-only view of the content.
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
