import React from 'react';
import { useAsyncDependency } from '../../utils/useAsyncDependency';
import { ErrorWithStack, LoadingPlaceholder } from '..';
// we only use import type so it will not load in the dependency
import type { EditorProps } from '@monaco-editor/react';

export const ReactMonacoEditorLazy = (props: EditorProps) => {
  const { loading, error, dependency } = useAsyncDependency(
    import(/* webpackChunkName: "react-monaco-editor" */ './ReactMonacoEditor')
  );

  if (loading) {
    return <LoadingPlaceholder text={''} />;
  }

  if (error) {
    return (
      <ErrorWithStack
        title="React Monaco Editor failed to load"
        error={error}
        errorInfo={{ componentStack: error?.stack || '' }}
      />
    );
  }

  const ReactMonacoEditor = dependency.ReactMonacoEditor;
  return <ReactMonacoEditor {...props} />;
};
