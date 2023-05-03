// We use `import type` to guarantee it'll be erased from the JS and it doesnt accidently bundle monaco
import type { EditorProps } from '@monaco-editor/react';
import type * as monacoType from 'monaco-editor/esm/vs/editor/editor.api';

// we do not allow customizing the theme.
// (theme is complicated in Monaco, right now there is
// a limitation where all monaco editors must have
// the same theme, see
// https://github.com/microsoft/monaco-editor/issues/338#issuecomment-274837186
// )
export type ReactMonacoEditorProps = Omit<EditorProps, 'theme'>;

export type CodeEditorChangeHandler = (value: string) => void;
export type CodeEditorSuggestionProvider = () => CodeEditorSuggestionItem[];

export type { monacoType as monacoTypes };
export type Monaco = typeof monacoType;
export type MonacoEditor = monacoType.editor.IStandaloneCodeEditor;
export type MonacoOptions = MonacoOptionsWithGrafanaDefaults;

export interface CodeEditorProps {
  value: string;
  language: string;
  width?: number | string;
  height?: number | string;

  readOnly?: boolean;
  showMiniMap?: boolean;
  showLineNumbers?: boolean;
  monacoOptions?: MonacoOptions;

  /**
   * Callback before the editor has mounted that gives you raw access to monaco
   */
  onBeforeEditorMount?: (monaco: Monaco) => void;

  /**
   * Callback after the editor has mounted that gives you raw access to monaco
   */
  onEditorDidMount?: (editor: MonacoEditor, monaco: Monaco) => void;

  /** Handler to be performed when editor is blurred */
  onBlur?: CodeEditorChangeHandler;

  /** Handler to be performed whenever the text inside the editor changes */
  onChange?: CodeEditorChangeHandler;

  /** Handler to be performed when Cmd/Ctrl+S is pressed */
  onSave?: CodeEditorChangeHandler;

  /**
   * Language agnostic suggestion completions -- typically for template variables
   */
  getSuggestions?: CodeEditorSuggestionProvider;

  containerStyles?: string;
}

/**
 * @alpha
 */
export enum CodeEditorSuggestionItemKind {
  Method = 'method',
  Field = 'field',
  Property = 'property',
  Constant = 'constant',
  Text = 'text',
}

/**
 * @alpha
 */
export interface CodeEditorSuggestionItem {
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
  kind?: CodeEditorSuggestionItemKind;

  /**
   * A human-readable string with additional information
   * about this item, like type or symbol information.
   */
  detail?: string;

  /**
   * A human-readable string that represents a doc-comment.
   */
  documentation?: string; // | IMarkdownString;

  /**
   * A string or snippet that should be inserted in a document when selecting
   * this completion. When `falsy` the `label` is used.
   */
  insertText?: string;
}

/**
 * This interface will extend the original Monaco editor options interface
 * but changing the code comments to contain the proper default values to
 * prevent the consumer of the CodeEditor to get incorrect documentation in editor.
 */
export interface MonacoOptionsWithGrafanaDefaults extends monacoType.editor.IStandaloneEditorConstructionOptions {
  /**
   * Enable custom contextmenu.
   * Defaults to false.
   */
  contextmenu?: boolean;
  /**
   * The number of spaces a tab is equal to.
   * This setting is overridden based on the file contents when `detectIndentation` is on.
   * Defaults to 4.
   */
  tabSize?: number;
  /**
   * Show code lens
   * Defaults to false.
   */
  codeLens?: boolean;
  /**
   * Control the width of line numbers, by reserving horizontal space for rendering at least an amount of digits.
   * Defaults to 4.
   */
  lineNumbersMinChars?: number;
  /**
   * The width reserved for line decorations (in px).
   * Line decorations are placed between line numbers and the editor content.
   * You can pass in a string in the format floating point followed by "ch". e.g. 1.3ch.
   * Defaults to 1 * theme.spacing.gridSize.
   */
  lineDecorationsWidth?: number | string;
  /**
   * Controls if a border should be drawn around the overview ruler.
   * Defaults to `false`.
   */
  overviewRulerBorder?: boolean;
  /**
   * Enable that the editor will install an interval to check if its container dom node size has changed.
   * Enabling this might have a severe performance impact.
   * Defaults to true.
   */
  automaticLayout?: boolean;
}
