import React from 'react';
import { withTheme } from '../../themes';
import { Themeable } from '../../types';
import { useAsyncDependency } from '../../utils/useAsyncDependency';
import { ErrorWithStack, LoadingPlaceholder } from '..';

export type CodeEditorChangeHandler = (value: string) => void;

export interface CodeEditorProps extends Themeable {
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

const UnthemedCodeEditor: React.FC<CodeEditorProps> = props => {
  const { loading, error, dependency } = useAsyncDependency(
    import(/* webpackChunkName: "code-editor-monaco" */ './LazyCodeEditor')
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

  const LazyCodeEditor = dependency.default;
  return <LazyCodeEditor {...props} />;
};

export const CodeEditor = withTheme(UnthemedCodeEditor);
