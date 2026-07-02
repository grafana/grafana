import type { Completion, CompletionContext, CompletionResult, CompletionSource } from '@codemirror/autocomplete';
import { type Extension } from '@codemirror/state';
import { type BasicSetupOptions } from '@uiw/react-codemirror';

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

export type CodeMirrorEditorLanguage = 'json' | 'sql';

/**
 * A CodeMirror theme: either a theme extension (e.g. from `EditorView.theme`)
 * or one of CodeMirror's built-in keywords.
 */
export type CodeMirrorEditorTheme = CodeMirrorExtension | 'light' | 'dark' | 'none';

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
}
