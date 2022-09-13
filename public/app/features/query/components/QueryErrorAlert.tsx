import { css } from '@emotion/css';
import React from 'react';

import { DataQueryError, GrafanaTheme2 } from '@grafana/data';
import { Icon, useStyles2 } from '@grafana/ui';

export interface Props {
  error: DataQueryError;
}

export function QueryErrorAlert({ error }: Props) {
  const styles = useStyles2(getStyles);

  const message = error?.message ?? error?.data?.message ?? 'Query error';

  return (
    <div className={styles.wrapper}>
      <div className={styles.icon}>
        <Icon name="exclamation-triangle" />
      </div>
      <div className={styles.message}>{message}</div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    marginTop: theme.spacing(0.5),
    background: theme.colors.background.secondary,
    display: 'flex',
  }),
  icon: css({
    background: theme.colors.error.main,
    color: theme.colors.error.contrastText,
    padding: theme.spacing(1),
  }),
  message: css({
    fontSize: theme.typography.bodySmall.fontSize,
    fontFamily: theme.typography.fontFamilyMonospace,
    padding: theme.spacing(1),
  }),
});
