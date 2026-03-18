import { Extension } from '@codemirror/state';

import { GrafanaTheme2 } from '@grafana/data';

export interface SyntaxHighlightConfig {
  pattern: RegExp; // MUST have global /g flag
  className: string;
}

export type ThemeFactory = (theme: GrafanaTheme2) => Extension;
export type HighlighterFactory = (config?: SyntaxHighlightConfig) => Extension;

export interface CodeMirrorEditorProps {
  value: string;
  onChange: (value: string, callback?: () => void) => void;
  onBlur?: (value: string) => void;
  placeholder?: string;
  themeFactory?: ThemeFactory;
  highlighterFactory?: HighlighterFactory;
  highlightConfig?: SyntaxHighlightConfig;
  autocompletion?: Extension;
  extensions?: Extension[];
  showLineNumbers?: boolean;
  lineWrapping?: boolean;
  ariaLabel?: string;
  className?: string;
  useInputStyles?: boolean; // default: true — applies Grafana input box styles
  closeBrackets?: boolean; // default: true
}
