import React from 'react';
import { useAsyncDependency } from '../../utils/useAsyncDependency';
import { ErrorWithStack, LoadingPlaceholder } from '..';
import { CodeEditorProps } from './types';

export const CodeEditor: React.FC<CodeEditorProps> = props => {
  const { loading, error, dependency } = useAsyncDependency(
    import(/* webpackChunkName: "code-editor" */ './CodeEditor')
  );

  if (loading) {
    return <LoadingPlaceholder text={''} />;
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

  const CodeEditor = dependency.default;
  return <CodeEditor {...props} />;
};
