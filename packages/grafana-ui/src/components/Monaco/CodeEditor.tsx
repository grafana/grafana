import React from 'react';
import { withTheme } from '../../themes';
import { Themeable } from '../../types';
import { CodeEditorProps } from './types';
import { registerSuggestions } from './suggestions';
import ReactMonaco from 'react-monaco-editor';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

type Props = CodeEditorProps & Themeable;

class UnthemedCodeEditor extends React.PureComponent<Props> {
  completionCancel?: monaco.IDisposable;

  componentWillUnmount() {
    if (this.completionCancel) {
      this.completionCancel.dispose();
    }
  }

  componentDidUpdate(oldProps: Props) {
    const { getSuggestions, language } = this.props;
    if (getSuggestions) {
      // Language changed
      if (language !== oldProps.language) {
        if (this.completionCancel) {
          this.completionCancel.dispose();
        }
        this.completionCancel = registerSuggestions(language, getSuggestions);
      }
    }
  }

  // This is replaced with a real function when the actual editor mounts
  getEditorValue = () => '';

  onBlur = () => {
    const { onBlur } = this.props;
    if (onBlur) {
      onBlur(this.getEditorValue());
    }
  };

  editorWillMount = (m: typeof monaco) => {
    const { language, getSuggestions } = this.props;
    if (getSuggestions) {
      this.completionCancel = registerSuggestions(language, getSuggestions);
    }
  };

  editorDidMount = (editor: monaco.editor.IStandaloneCodeEditor) => {
    const { onSave, onEditorDidMount } = this.props;

    this.getEditorValue = () => editor.getValue();

    if (onSave) {
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_S, () => {
        onSave(this.getEditorValue());
      });
    }

    if (onEditorDidMount) {
      onEditorDidMount(editor);
    }
  };

  render() {
    const { theme, language, width, height, showMiniMap, showLineNumbers, readOnly } = this.props;
    const value = this.props.value ?? '';
    const longText = value.length > 100;

    const options: monaco.editor.IEditorConstructionOptions = {
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
    };
    if (!showLineNumbers) {
      options.glyphMargin = false;
      options.folding = false;
      options.lineNumbers = 'off';
      options.lineDecorationsWidth = 5; // left margin when not showing line numbers
      options.lineNumbersMinChars = 0;
    }

    return (
      <div onBlur={this.onBlur}>
        <ReactMonaco
          width={width}
          height={height}
          language={language}
          theme={theme.isDark ? 'vs-dark' : 'vs-light'}
          value={value}
          options={options}
          editorWillMount={this.editorWillMount}
          editorDidMount={this.editorDidMount}
        />
      </div>
    );
  }
}

export default withTheme(UnthemedCodeEditor);
