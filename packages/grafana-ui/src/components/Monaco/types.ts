export type CodeEditorChangeHandler = (value: string) => void;

export interface CodeEditorProps {
  value: string;
  language: string;
  width?: number | string;
  height?: number | string;

  readOnly?: boolean;
  showMiniMap?: boolean;

  /**
   * Callback after the editor has mounted that gives you raw access to monaco
   *
   * @experimental - real type is: monaco.editor.IStandaloneCodeEditor
   */
  onEditorDidMount?: (editor: any) => void;

  /** Handler to be performed when editor is blurred */
  onBlur?: CodeEditorChangeHandler;

  /** Handler to be performed when Cmd/Ctrl+S is pressed */
  onSave?: CodeEditorChangeHandler;

  /**
   * Language agnostic suggestion completions -- typically for template variables
   */
  getSuggestions?: () => CodeEditorSuggestionItem[];
}

export enum CodeEditorSuggestionItemKind {
  Method = 0,
  Function = 1,
  Field = 3,
  Variable = 4,
  Property = 9,
  Constant = 14,
  Keyword = 17,
}

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
   * A string or snippet that should be inserted in a document when selecting
   * this completion. When `falsy` the `label` is used.
   */
  insertText?: string;
}
