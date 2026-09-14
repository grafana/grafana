import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';

import { useStyles2 } from '../../themes/ThemeContext';
import { useAsyncDependency } from '../../utils/useAsyncDependency';
import { ErrorWithStack } from '../ErrorBoundary/ErrorWithStack';
import { LoadingPlaceholder } from '../LoadingPlaceholder/LoadingPlaceholder';

// we only use import type so it will not be included in the bundle
import type { ReactMonacoDiffEditorProps } from './types';

/**
 * @internal
 * Experimental export
 **/
export const ReactMonacoDiffEditorLazy = (props: ReactMonacoDiffEditorProps) => {
  const styles = useStyles2(getStyles);
  const { loading, error, dependency } = useAsyncDependency(
    import(/* webpackChunkName: "react-monaco-diff-editor" */ './ReactMonacoDiffEditor')
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

  const ReactMonacoDiffEditor = dependency.ReactMonacoDiffEditor;
  return <ReactMonacoDiffEditor {...props} loading={props.loading ?? null} />;
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      marginBottom: 'unset',
      marginLeft: theme.spacing(1),
    }),
  };
};
