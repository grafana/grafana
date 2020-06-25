import React from 'react';
import { withTheme } from '../../themes';
import { Themeable } from '../../types';
import { MonacoEditorProps } from 'react-monaco-editor';
import { useAsyncDependency } from '../../utils/useAsyncDependency';
import { ErrorWithStack, LoadingPlaceholder } from '..';

import * as monaco from 'monaco-editor';

// @ts-ignore
self.MonacoEnvironment = {
  getWorkerUrl: (moduleId: string, label: string) => {
    console.log('MonacoEnvironment GET WORKER URL', moduleId, label);
    if (label === 'json') {
      return './monaco.json.worker.bundle.js';
    }
    if (label === 'css') {
      return './monaco.css.worker.bundle.js';
    }
    if (label === 'html') {
      return './monaco.html.worker.bundle.js';
    }
    if (label === 'typescript' || label === 'javascript') {
      return './monaco.ts.worker.bundle.js';
    }
    return './monaco.editor.worker.bundle.js';
  },
};

export type CodeEditorChangeHandler = (value: string) => void;

const MonacoEditor: React.FC<MonacoEditorProps> = props => {
  const { loading, error, dependency } = useAsyncDependency(
    import(/* webpackChunkName: "react-monaco-editor" */ 'react-monaco-editor')
  );

  if (loading) {
    return <LoadingPlaceholder text={'Loading...'} />;
  }

  if (error) {
    return (
      <ErrorWithStack
        title="Code editor failed to load"
        error={error}
        errorInfo={{ componentStack: error?.stack || '' }}
      />
    );
  }

  const ReactMonaco = dependency.default;
  return <ReactMonaco {...props} />;
};

interface CodeEditorProps extends Themeable {
  value: string;
  language: string;
  width?: number | string;
  height?: number | string;

  readOnly?: boolean;
  showMiniMap?: boolean;

  /**
   * Callback after the editor has mounted that gives you raw access to monaco
   *
   * @experimental
   */
  onEditorDidMount?: (editor: any) => void;
  //onEditorDidMount?: (editor: monaco.editor.IStandaloneCodeEditor) => void;

  /** Handler to be performed when editor is blurred */
  onBlur?: CodeEditorChangeHandler;

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
    const { theme, language, width, height, showMiniMap, readOnly } = this.props;
    const value = this.props.value ?? '';
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

export const CodeEditor = withTheme(UnthemedCodeEditor);
