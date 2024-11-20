import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

export interface Props {
  title: string;
  children: React.ReactNode;
}

export function OptionsPaneSection({ title, children }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>{title}</div>
      <div className={styles.body}>{children}</div>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    wrapper: css({
      display: 'flex',
      flexDirection: 'column',
    }),
    header: css({
      textAlign: 'center',
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      margin: theme.spacing(0, 0),
    }),
    body: css({
      display: 'flex',
      padding: theme.spacing(1),
    }),
  };
}
