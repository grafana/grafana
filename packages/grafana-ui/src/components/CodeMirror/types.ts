import type { Completion, CompletionContext, CompletionResult, CompletionSource } from '@codemirror/autocomplete';
import { type EditorState, type Extension } from '@codemirror/state';

export type CodeMirrorCompletion = Completion;
export type CodeMirrorCompletionContext = CompletionContext;
export type CodeMirrorCompletionResult = CompletionResult;
export type CodeMirrorCompletionSource = CompletionSource;

export type CodeMirrorExtension = Extension;

export type CodeMirrorCompletionMode = 'override' | 'merge';

export type CodeMirrorEditorLanguage = 'json' | 'sql';

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
 */
export interface SignatureInformation {
  /**
   * Full signature label shown in the tooltip header.
   */
  label: string;
  /**
   * Optional description of the function.
   */
  documentation?: string;
  /**
   * Ordered list of parameters used to highlight the active argument.
   */
  parameters: SignatureParameter[];
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
