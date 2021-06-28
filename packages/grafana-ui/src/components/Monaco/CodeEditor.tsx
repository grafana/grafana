import React from 'react';
import { css } from '@emotion/css';
import MonacoEditor, { loader as monacoEditorLoader } from '@monaco-editor/react';
import type * as monacoType from 'monaco-editor/esm/vs/editor/editor.api';
import { selectors } from '@grafana/e2e-selectors';
import { GrafanaTheme2, monacoLanguageRegistry } from '@grafana/data';

import { withTheme2 } from '../../themes';
import { Themeable2 } from '../../types';

import { CodeEditorProps, Monaco, MonacoEditor as MonacoEditorType, MonacoOptions } from './types';
import { registerSuggestions } from './suggestions';
import defineThemes from './theme';

type Props = CodeEditorProps & Themeable2;

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

  handleBeforeMount = (monaco: Monaco) => {
    this.monaco = monaco;
    const { language, theme, getSuggestions } = this.props;
    defineThemes(monaco, theme);

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

    const languagePromise = this.loadCustomLanguage();

    if (onEditorDidMount) {
      languagePromise.then(() => onEditorDidMount(editor, monaco));
    }
  };

  render() {
    const { theme, language, width, height, showMiniMap, showLineNumbers, readOnly, monacoOptions } = this.props;
    const value = this.props.value ?? '';
    const longText = value.length > 100;

    const styles = getStyles(theme);

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
    };

    if (!showLineNumbers) {
      options.glyphMargin = false;
      options.folding = false;
      options.lineNumbers = 'off';
      options.lineNumbersMinChars = 0;
    }

    return (
      <div className={styles.container} onBlur={this.onBlur} aria-label={selectors.components.CodeEditor.container}>
        <MonacoEditor
          width={width}
          height={height}
          language={language}
          theme={theme.isDark ? 'grafana-dark' : 'grafana-light'}
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

export default withTheme2(UnthemedCodeEditor);

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css`
      border-radius: ${theme.shape.borderRadius()};
      border: 1px solid ${theme.components.input.borderColor};
    `,
  };
};
