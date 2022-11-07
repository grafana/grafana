import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { PageInfo } from '../Page/types';

export interface Props {
  info: PageInfo[];
}

export function PageStats({ info }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container}>
      {info.map((infoItem, index) => (
        <>
          <div key={index} className={styles.infoItem}>
            <div className={styles.label}>{infoItem.label}</div>
            {infoItem.value}
          </div>
          {index + 1 < info.length && <div className={styles.separator} />}
        </>
      ))}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'row',
      gap: theme.spacing(1.5),
      overflow: 'auto',
    }),
    infoItem: css({
      ...theme.typography.bodySmall,
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.5),
    }),
    label: css({
      color: theme.colors.text.secondary,
    }),
    separator: css({
      borderLeft: `1px solid ${theme.colors.border.weak}`,
    }),
    value: css({
      alignItems: 'center',
      display: 'flex',
      flex: 1,
    }),
  };
};
