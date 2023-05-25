import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

interface Props {
  title: string;
}

export function DataSourceTitle({ title }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>{title}</h1>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      marginBottom: theme.spacing(2),
      h1: {
        display: 'inline-block',
      },
    }),
    title: css({
      display: 'inline-block',
      margin: '0 0 0 0',
      maxWidth: '40vw',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }),
  };
};
