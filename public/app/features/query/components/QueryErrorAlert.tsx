import React from 'react';
import { DataQueryError, GrafanaTheme2 } from '@grafana/data';
import { Icon, useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';

export interface Props {
  error: DataQueryError;
}

export function QueryErrorAlert({ error }: Props) {
  const styles = useStyles2(getStyles);

  const message = error?.message ?? error?.data?.message ?? 'Query error';

  return (
    <div className={styles.wrapper}>
      <Icon name="exclamation-triangle" className={styles.icon} /> {message}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    marginTop: theme.spacing(0.5),
    padding: theme.spacing(1),
    background: theme.colors.background.secondary,
    color: theme.colors.error.text,
    fontFamily: theme.typography.fontFamilyMonospace,
  }),
  icon: css({
    marginRight: theme.spacing(1),
  }),
});
