import React from 'react';
import { withTheme } from '../../themes';
import { Themeable } from '../../types';
import { CodeEditorProps } from './types';
import { registerSuggestions } from './suggestions';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import ReactMonaco from 'react-monaco-editor';

type Props = CodeEditorProps & Themeable;

class UnthemedCodeEditor extends React.PureComponent<Props> {
  completionCancel?: monaco.IDisposable;

  componentWillUnmount() {
    if (this.completionCancel) {
      console.log('dispose of the custom completion stuff');
      this.completionCancel.dispose();
    }
  }

  getEditorValue = () => '';

  onBlur = () => {
    const { onBlur } = this.props;
    if (onBlur) {
      onBlur(this.getEditorValue());
    }
  };

  editorDidMount = (editor: monaco.editor.IStandaloneCodeEditor) => {
    const { onSave, onEditorDidMount, language, getSuggestions } = this.props;

    this.getEditorValue = () => editor.getValue();

    if (onSave) {
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_S, () => {
        onSave(this.getEditorValue());
      });
    }

    if (onEditorDidMount) {
      onEditorDidMount(editor);
    }

    if (getSuggestions) {
      this.completionCancel = registerSuggestions(language, getSuggestions);
    }
  };

  render() {
    const { theme, language, width, height, showMiniMap, readOnly } = this.props;
    const value = this.props.value ?? '';
    const longText = value.length > 100;

    return (
      <div onBlur={this.onBlur}>
        <ReactMonaco
          width={width}
          height={height}
          language={language}
          theme={theme.isDark ? 'vs-dark' : 'vs-light'}
          value={value}
          options={{
            wordWrap: 'off',
            codeLens: false, // not included in the bundle
            minimap: {
              enabled: longText && showMiniMap,
              renderCharacters: false,
            },
            readOnly,
            lineNumbersMinChars: 4,
            lineDecorationsWidth: 0,
            overviewRulerBorder: false,
            automaticLayout: true,
          }}
          editorDidMount={this.editorDidMount}
        />
      </div>
    );
  }
}

export default withTheme(UnthemedCodeEditor);
