import React, { FC } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';
import { useStyles } from '@grafana/ui';
import { Route } from 'app/plugins/datasource/alertmanager/types';
import { AmRoutesTable } from './AmRoutesTable';

export interface AmRoutesExpandedReadProps {
  route: Route;
}

export const AmRoutesExpandedRead: FC<AmRoutesExpandedReadProps> = ({ route }) => {
  const styles = useStyles(getStyles);

  return (
    <>
      <div className={styles.row}>
        <div className={styles.col1}>Group wait</div>
        <div className={styles.col2}>{route.group_wait ?? '-'}</div>
      </div>
      <div className={styles.row}>
        <div className={styles.col1}>Repeat interval</div>
        <div className={styles.col2}>{route.repeat_interval ?? '-'}</div>
      </div>
      <div className={styles.row}>
        <div className={styles.col1}>Nested policies</div>
        <div className={styles.col2}>{route.routes ? <AmRoutesTable routes={route.routes ?? []} /> : '-'}</div>
      </div>
    </>
  );
};

const getStyles = (theme: GrafanaTheme) => {
  return {
    row: css`
      display: flex;
      flex-flow: row nowrap;
      font-style: ${theme.typography.size.sm};
      margin-bottom: 12px;
      padding: 0 32px;
    `,
    col1: css`
      color: ${theme.colors.textHeading};
      flex: 124px;
    `,
    col2: css`
      flex: 100%;
    `,
  };
};
