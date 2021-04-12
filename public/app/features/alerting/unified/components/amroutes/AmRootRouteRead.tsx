import React, { FC } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';
import { useStyles } from '@grafana/ui';
import { Route } from '../../../../../plugins/datasource/alertmanager/types';

export interface AmRootRouteReadProps {
  route: Route | undefined;
}

export const AmRootRouteRead: FC<AmRootRouteReadProps> = ({ route }) => {
  const styles = useStyles(getStyles);

  return (
    <>
      <div className={styles.row}>
        <div className={styles.col1}>Receiver channel</div>
        <div className={styles.col2}>{route?.receiver ?? '-'}</div>
      </div>
      <div className={styles.row}>
        <div className={styles.col1}>Group by</div>
        <div className={styles.col2}>{(route?.group_by ?? []).join(', ') || '-'}</div>
      </div>
      <div className={styles.row}>
        <div className={styles.col1}>Timings</div>
        <div className={styles.col2}>
          Group wait: {route?.group_wait ?? '-'} | Group interval: {route?.group_interval ?? '-'} | Repeat interval:{' '}
          {route?.repeat_interval ?? '-'}
        </div>
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
