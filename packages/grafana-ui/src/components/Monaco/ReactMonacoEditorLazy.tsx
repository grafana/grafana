import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';

import { useStyles2 } from '../../themes/ThemeContext';
import { useAsyncDependency } from '../../utils/useAsyncDependency';
import { ErrorWithStack } from '../ErrorBoundary/ErrorWithStack';
import { LoadingPlaceholder } from '../LoadingPlaceholder/LoadingPlaceholder';

// we only use import type so it will not be included in the bundle
import type { ReactMonacoEditorProps } from './types';

/**
 * @internal
 * Experimental export
 **/
export const ReactMonacoEditorLazy = (props: ReactMonacoEditorProps) => {
  const styles = useStyles2(getStyles);
  const { loading, error, dependency } = useAsyncDependency(
    import(/* webpackChunkName: "react-monaco-editor" */ './ReactMonacoEditor')
  );

  if (loading) {
    return (
      <LoadingPlaceholder
        text={t('grafana-ui.monaco.loading-placeholder', 'Loading editor')}
        className={styles.container}
      />
    );
  }

  if (error) {
    return (
      <ErrorWithStack
        title={t('grafana-ui.monaco.error-label', 'React Monaco Editor failed to load')}
        error={error}
        errorInfo={{ componentStack: error?.stack ?? '' }}
      />
    );
  }

  const ReactMonacoEditor = dependency.ReactMonacoEditor;
  return (
    <ReactMonacoEditor
      {...props}
      loading={props.loading ?? null}
      wrapperProps={{
        'data-testid': selectors.components.ReactMonacoEditor.editorLazy,
      }}
    />
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      marginBottom: 'unset',
      marginLeft: theme.spacing(1),
    }),
  };
};
