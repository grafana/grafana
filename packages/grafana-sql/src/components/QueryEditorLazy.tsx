import { css } from '@emotion/css';
import { lazy, Suspense } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { LoadingPlaceholder, useStyles2 } from '@grafana/ui';

import type { SqlQueryEditorProps } from './QueryEditor';
const QueryEditor = lazy(() => import(/* webpackChunkName: "sql-query-editor" */ './QueryEditor'));

export function SqlQueryEditorLazy(props: SqlQueryEditorProps) {
  const styles = useStyles2(getStyles);

  return (
    <Suspense
      fallback={
        <LoadingPlaceholder
          text={t('grafana-sql.components.sql-query-editor-lazy.text-loading-editor', 'Loading editor')}
          className={styles.container}
        />
      }
    >
      <QueryEditor {...props} />
    </Suspense>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      marginBottom: 'unset',
      marginLeft: theme.spacing(1),
    }),
  };
};
