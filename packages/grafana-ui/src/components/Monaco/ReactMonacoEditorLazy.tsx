import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { useStyles2 } from '../../themes';
import { useAsyncDependency } from '../../utils/useAsyncDependency';
import { ErrorWithStack } from '../ErrorBoundary/ErrorWithStack';
import { LoadingPlaceholder } from '../LoadingPlaceholder/LoadingPlaceholder';

// we only use import type so it will not be included in the bundle
import type { ReactMonacoEditorProps } from './types';

/**
 * @internal
 * Experimental export
 **/
const MonacoEditorLazy = (props: ReactMonacoEditorProps) => {
  const styles = useStyles2(getStyles);
  const { loading, error, dependency } = useAsyncDependency(
    import(/* webpackChunkName: "react-monaco-editor" */ './ReactMonacoEditor')
  );

  if (loading) {
    return <LoadingPlaceholder text={'Loading editor'} className={styles.container} />;
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
  return <ReactMonacoEditor {...props} loading={props.loading ?? null} />;
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      marginBottom: 'unset',
      marginLeft: theme.spacing(1),
    }),
  };
};

const withContainer = <P extends object>(Component: React.ComponentType<P>): React.ComponentType<P> => {
  const WithContainer = (props: P) => (
    // allow tests to easily determine if the code editor has rendered in any of its three states (loading, error, or ready)
    <div data-testid={selectors.components.ReactMonacoEditor.container}>
      <Component {...props} />
    </div>
  );

  WithContainer.displayName = Component.displayName;

  return WithContainer;
};

export const ReactMonacoEditorLazy = withContainer(MonacoEditorLazy);
