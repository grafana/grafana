import React from 'react';
import { withTheme } from '../../themes';
import { Themeable } from '../../types';
import MonacoEditor from 'react-monaco-editor';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

export type CodeEditorChangeHandler = (value: string) => void;

interface CodeEditorProps extends Themeable {
  value: string;
  language: string;
  readOnly?: boolean;
  width?: number | string;
  height?: number | string;

  // /**
  //  * Callback after the editor has mounted that gives you raw access to monaco
  //  *
  //  * @experimental
  //  */
  // onEditorDidMount?: (editor: monaco.editor.IStandaloneCodeEditor) => void;

  /** Handler to be performed when editor is blurred */
  onBlur?: CodeEditorChangeHandler;

  onChange?: CodeEditorChangeHandler;

  /** Handler to be performed when Cmd/Ctrl+S is pressed */
  onSave?: CodeEditorChangeHandler;
}

class UnthemedCodeEditor extends React.PureComponent<CodeEditorProps> {
  constructor(props: CodeEditorProps) {
    super(props);
  }

  getEditorValue = () => '';

  onBlur = () => {
    const { onBlur } = this.props;
    if (onBlur) {
      onBlur(this.getEditorValue());
    }
  };

  onChange = () => {
    const { onChange } = this.props;
    if (onChange) {
      onChange(this.getEditorValue());
    }
  };

  editorDidMount = (editor: monaco.editor.IStandaloneCodeEditor) => {
    const { onSave } = this.props;

    this.getEditorValue = () => editor.getValue();

    if (onSave) {
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_S, () => {
        onSave(this.getEditorValue());
      });
    }

    // if (onEditorDidMount) {
    //   onEditorDidMount(editor);
    // }
  };

  render() {
    const { value, theme, language, width, height } = this.props;
    const longText = value.length > 100;

    return (
      <div onBlur={this.onBlur}>
        <MonacoEditor
          width={width}
          height={height}
          language={language}
          theme={theme.isDark ? 'vs-dark' : 'vs-light'}
          value={value}
          options={{
            wordWrap: 'off',
            codeLens: false, // too small to bother (and not compiled)
            minimap: {
              enabled: longText,
              renderCharacters: false,
            },
            readOnly: this.props.readOnly,
            lineNumbersMinChars: 4,
            lineDecorationsWidth: 0,
            overviewRulerBorder: false,
            automaticLayout: true,
          }}
          editorDidMount={this.editorDidMount}
          onChange={this.onChange}
        />
      </div>
    );
  }
}

export const CodeEditor = withTheme(UnthemedCodeEditor);
