import React from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { withTheme } from '../../themes';
import { Themeable } from '../../types';
import { Monaco, MonacoEditor as MonacoEditorType, CodeEditorProps, MonacoOptions } from './types';
import { registerSuggestions } from './suggestions';
import MonacoEditor, { loader as monacoEditorLoader } from '@monaco-editor/react';

import type * as monacoType from 'monaco-editor/esm/vs/editor/editor.api';

type Props = CodeEditorProps & Themeable;

let initalized = false;
function initMonoco() {
  if (initalized) {
    return;
  }

  monacoEditorLoader.config({
    paths: {
      vs: (window.__grafana_public_path__ ?? 'public/') + 'lib/monaco/min/vs',
    },
  });
  initalized = true;
}

class UnthemedCodeEditor extends React.PureComponent<Props> {
  completionCancel?: monacoType.IDisposable;
  monaco?: Monaco;

  constructor(props: Props) {
    super(props);
    initMonoco();
  }

  componentWillUnmount() {
    if (this.completionCancel) {
      this.completionCancel.dispose();
    }
  }

  componentDidUpdate(oldProps: Props) {
    const { getSuggestions, language } = this.props;

    if (language !== oldProps.language) {
      if (this.completionCancel) {
        this.completionCancel.dispose();
      }

      if (!this.monaco) {
        console.warn('Monaco instance not loaded yet');
        return;
      }

      if (getSuggestions) {
        this.completionCancel = registerSuggestions(this.monaco, language, getSuggestions);
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

  handleBeforeMount = (monaco: Monaco) => {
    this.monaco = monaco;
    const { language, getSuggestions } = this.props;

    if (getSuggestions) {
      this.completionCancel = registerSuggestions(monaco, language, getSuggestions);
    }
  };

  handleOnMount = (editor: MonacoEditorType, monaco: Monaco) => {
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
    const { theme, language, width, height, showMiniMap, showLineNumbers, readOnly, monacoOptions } = this.props;
    const value = this.props.value ?? '';
    const longText = value.length > 100;

    const options: MonacoOptions = {
      wordWrap: 'off',
      tabSize: 2,
      codeLens: false,
      contextmenu: false,

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
      <div onBlur={this.onBlur} aria-label={selectors.components.CodeEditor.container}>
        <MonacoEditor
          width={width}
          height={height}
          language={language}
          theme={theme.isDark ? 'vs-dark' : 'vs-light'}
          value={value}
          options={{
            ...options,
            ...(monacoOptions ?? {}),
          }}
          beforeMount={this.handleBeforeMount}
          onMount={this.handleOnMount}
        />
      </div>
    );
  }
}

export default withTheme(UnthemedCodeEditor);
