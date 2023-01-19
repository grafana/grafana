import { css } from '@emotion/css';
import type * as monacoType from 'monaco-editor/esm/vs/editor/editor.api';
import React, { PureComponent } from 'react';

import { GrafanaTheme2, monacoLanguageRegistry } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { withTheme2 } from '../../themes';
import { Themeable2 } from '../../types';

import { ReactMonacoEditorLazy } from './ReactMonacoEditorLazy';
import { registerSuggestions } from './suggestions';
import { CodeEditorProps, Monaco, MonacoEditor as MonacoEditorType, MonacoOptions } from './types';

type Props = CodeEditorProps & Themeable2;

class UnthemedCodeEditor extends PureComponent<Props> {
  completionCancel?: monacoType.IDisposable;
  monaco?: Monaco;

  constructor(props: Props) {
    super(props);
  }

  componentWillUnmount() {
    if (this.completionCancel) {
      this.completionCancel.dispose();
    }
  }

  componentDidUpdate(oldProps: Props) {
    const { getSuggestions, language } = this.props;

    const newLanguage = oldProps.language !== language;
    const newGetSuggestions = oldProps.getSuggestions !== getSuggestions;

    if (newGetSuggestions || newLanguage) {
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

    if (newLanguage) {
      this.loadCustomLanguage();
    }
  }

  loadCustomLanguage = () => {
    const { language } = this.props;

    const customLanguage = monacoLanguageRegistry.getIfExists(language);

    if (customLanguage) {
      return customLanguage.init();
    }

    return Promise.resolve();
  };

  // This is replaced with a real function when the actual editor mounts
  getEditorValue = () => '';

  onBlur = () => {
    const { onBlur } = this.props;
    if (onBlur) {
      onBlur(this.getEditorValue());
    }
  };

  onSave = () => {
    const { onSave } = this.props;
    if (onSave) {
      onSave(this.getEditorValue());
    }
  };

  handleBeforeMount = (monaco: Monaco) => {
    this.monaco = monaco;
    const { language, getSuggestions, onBeforeEditorMount } = this.props;

    if (getSuggestions) {
      this.completionCancel = registerSuggestions(monaco, language, getSuggestions);
    }

    onBeforeEditorMount?.(monaco);
  };

  handleOnMount = (editor: MonacoEditorType, monaco: Monaco) => {
    const { onChange, onEditorDidMount } = this.props;

    this.getEditorValue = () => editor.getValue();

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, this.onSave);
    const languagePromise = this.loadCustomLanguage();

    if (onEditorDidMount) {
      languagePromise.then(() => onEditorDidMount(editor, monaco));
      editor.getModel()?.onDidChangeContent(() => onChange?.(editor.getValue()));
    }
  };

  render() {
    const { theme, language, width, height, showMiniMap, showLineNumbers, readOnly, monacoOptions } = this.props;
    const value = this.props.value ?? '';
    const longText = value.length > 100;

    const containerStyles = this.props.containerStyles ?? getStyles(theme).container;

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
      lineDecorationsWidth: 1 * theme.spacing.gridSize,
      overviewRulerBorder: false,
      automaticLayout: true,
      padding: {
        top: 0.5 * theme.spacing.gridSize,
        bottom: 0.5 * theme.spacing.gridSize,
      },
      fixedOverflowWidgets: true, // Ensures suggestions menu is drawn on top
    };

    if (!showLineNumbers) {
      options.glyphMargin = false;
      options.folding = false;
      options.lineNumbers = 'off';
      options.lineNumbersMinChars = 0;
    }

    return (
      <div className={containerStyles} onBlur={this.onBlur} aria-label={selectors.components.CodeEditor.container}>
        <ReactMonacoEditorLazy
          width={width}
          height={height}
          language={language}
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

export const CodeEditor = withTheme2(UnthemedCodeEditor);

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css`
      border-radius: ${theme.shape.borderRadius()};
      border: 1px solid ${theme.components.input.borderColor};
    `,
  };
};
