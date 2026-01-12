import { Extension } from '@codemirror/state';

import { GrafanaTheme2 } from '@grafana/data';

/**
 * Configuration options for syntax highlighting
 */
export interface SyntaxHighlightConfig {
  /**
   * Pattern to match for highlighting
   */
  pattern: RegExp;
  /**
   * CSS class to apply to matched text
   */
  className: string;
}

/**
 * Function to create a theme extension
 */
export type ThemeFactory = (theme: GrafanaTheme2) => Extension;

/**
 * Function to create a syntax highlighter extension
 */
export type HighlighterFactory = (config?: SyntaxHighlightConfig) => Extension;

/**
 * Function to create an autocompletion extension
 */
export type AutocompletionFactory<T = unknown> = (data: T) => Extension;

/**
 * Props for the CodeMirrorEditor component
 */
export interface CodeMirrorEditorProps {
  /**
   * The current value of the editor
   */
  value: string;

  /**
   * Callback when the editor value changes
   */
  onChange: (value: string, callback?: () => void) => void;

  /**
   * Placeholder text to display when editor is empty
   */
  placeholder?: string;

  /**
   * Custom theme factory function
   */
  themeFactory?: ThemeFactory;

  /**
   * Custom syntax highlighter factory function
   */
  highlighterFactory?: HighlighterFactory;

  /**
   * Configuration for syntax highlighting
   */
  highlightConfig?: SyntaxHighlightConfig;

  /**
   * Custom autocompletion extension
   */
  autocompletion?: Extension;

  /**
   * Additional CodeMirror extensions to apply
   */
  extensions?: Extension[];

  /**
   * Whether to show line numbers (default: false)
   */
  showLineNumbers?: boolean;

  /**
   * Whether to enable line wrapping (default: true)
   */
  lineWrapping?: boolean;

  /**
   * Aria label for accessibility
   */
  ariaLabel?: string;

  /**
   * Custom CSS class for the container
   */
  className?: string;

  /**
   * Whether to apply input styles (default: true)
   */
  useInputStyles?: boolean;

  /**
   * Whether to enable automatic closing of brackets and braces (default: true)
   */
  closeBrackets?: boolean;
}
