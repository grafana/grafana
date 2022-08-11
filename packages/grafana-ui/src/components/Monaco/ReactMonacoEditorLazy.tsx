import React from 'react';

import { ErrorWithStack, LoadingPlaceholder } from '..';
import { useAsyncDependency } from '../../utils/useAsyncDependency';

// we only use import type so it will not be included in the bundle
import type { ReactMonacoEditorProps } from './types';

/**
 * @internal
 * Experimental export
 **/
export const ReactMonacoEditorLazy = (props: ReactMonacoEditorProps) => {
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
