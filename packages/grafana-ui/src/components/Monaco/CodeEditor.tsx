import React from 'react';
import { withTheme } from '../../themes';
import { Themeable } from '../../types';
import MonacoEditor from 'react-monaco-editor';
import AutoSizer from 'react-virtualized-auto-sizer';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

export enum CodeEditorUpdateAction {
  Blur = 'blur',
  Save = 'save',
}

export interface Props extends Themeable {
  text: string;

  language: string;

  readOnly?: boolean;

  onChange: (text: string, action: CodeEditorUpdateAction) => void;
}

class UnthemedCodeEditor extends React.PureComponent<Props> {
  constructor(props: Props) {
    super(props);
  }

  getEditorValue = () => '';

  onBlur = () => {
    const val = this.getEditorValue();
    this.props.onChange(val, CodeEditorUpdateAction.Blur);
  };

  editorDidMount = (editor: monaco.editor.IStandaloneCodeEditor) => {
    console.log('editorDidMount', editor);

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_S, () => {
      const val = this.getEditorValue();
      this.props.onChange(val, CodeEditorUpdateAction.Save);
    });
    this.getEditorValue = () => editor.getValue();
  };

  render() {
    const { text, theme, language } = this.props;
    const longText = text.length > 100;

    return (
      <AutoSizer disableWidth>
        {({ height }) => (
          <div onBlur={this.onBlur}>
            <MonacoEditor
              height={height}
              language={language}
              width="100%"
              theme={theme.isDark ? 'vs-dark' : 'vs-light'}
              value={text}
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
            />
          </div>
        )}
      </AutoSizer>
    );
  }
}

export const CodeEditor = withTheme(UnthemedCodeEditor);
