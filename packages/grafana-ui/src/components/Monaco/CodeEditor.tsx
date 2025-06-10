import { css } from '@emotion/css';
import type * as monacoType from 'monaco-editor/esm/vs/editor/editor.api';
import { PureComponent } from 'react';

import { GrafanaTheme2, monacoLanguageRegistry } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { withTheme2 } from '../../themes/ThemeContext';
import { Themeable2 } from '../../types/theme';

import { ReactMonacoEditorLazy } from './ReactMonacoEditorLazy';
import { registerSuggestions } from './suggestions';
import { CodeEditorProps, Monaco, MonacoEditor as MonacoEditorType, MonacoOptions } from './types';

type Props = CodeEditorProps & Themeable2;

class UnthemedCodeEditor extends PureComponent<Props> {
  completionCancel?: monacoType.IDisposable;
  monaco?: Monaco;
  modelId?: string;

  constructor(props: Props) {
    super(props);
  }

  componentWillUnmount() {
    if (this.completionCancel) {
      this.completionCancel.dispose();
    }

    this.props.onEditorWillUnmount?.();
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

      if (getSuggestions && this.modelId) {
        this.completionCancel = registerSuggestions(this.monaco, language, getSuggestions, this.modelId);
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

  onFocus = () => {
    const { onFocus } = this.props;
    if (onFocus) {
      onFocus(this.getEditorValue());
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

    const { onBeforeEditorMount } = this.props;

    onBeforeEditorMount?.(monaco);
  };

  handleOnMount = (editor: MonacoEditorType, monaco: Monaco) => {
    const { getSuggestions, language, onChange, onEditorDidMount } = this.props;

    this.modelId = editor.getModel()?.id;
    this.getEditorValue = () => editor.getValue();

    if (getSuggestions && this.modelId) {
      this.completionCancel = registerSuggestions(monaco, language, getSuggestions, this.modelId);
    }

    // Save when pressing Ctrl+S or Cmd+S
    editor.onKeyDown((e: monacoType.IKeyboardEvent) => {
      if (e.keyCode === monaco.KeyCode.KeyS && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.onSave();
      }
    });

    if (onChange) {
      editor.getModel()?.onDidChangeContent(() => onChange(editor.getValue()));
    }

    if (onEditorDidMount) {
      onEditorDidMount(editor, monaco);
    }
  };

  render() {
    const { theme, language, width, height, showMiniMap, showLineNumbers, readOnly, wordWrap, monacoOptions } =
      this.props;
    const { alwaysConsumeMouseWheel, ...restMonacoOptions } = monacoOptions ?? {};

    const value = this.props.value ?? '';
    const longText = value.length > 100;

    const containerStyles = this.props.containerStyles ?? getStyles(theme).container;

    const options: MonacoOptions = {
      wordWrap: wordWrap ? 'on' : 'off',
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

      scrollbar: {
        alwaysConsumeMouseWheel: alwaysConsumeMouseWheel ?? false,
      },
    };

    if (!showLineNumbers) {
      options.glyphMargin = false;
      options.folding = false;
      options.lineNumbers = 'off';
      options.lineNumbersMinChars = 0;
    }

    return (
      <div
        className={containerStyles}
        onFocus={this.onFocus}
        onBlur={this.onBlur}
        data-testid={selectors.components.CodeEditor.container}
      >
        <ReactMonacoEditorLazy
          width={width}
          height={height}
          language={language}
          value={value}
          options={{
            ...options,
            ...(restMonacoOptions ?? {}),
          }}
          beforeMount={this.handleBeforeMount}
          onMount={this.handleOnMount}
          keepCurrentModel={true}
        />
      </div>
    );
  }
}

export const CodeEditor = withTheme2(UnthemedCodeEditor);

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      borderRadius: theme.shape.radius.default,
      border: `1px solid ${theme.components.input.borderColor}`,
    }),
  };
};
