import React, { FC } from 'react';
import { useStyles } from '@grafana/ui';
import { Route } from 'app/plugins/datasource/alertmanager/types';
import { getGridStyles } from './gridStyles';

export interface AmRootRouteReadProps {
  route: Route | undefined;
}

export const AmRootRouteRead: FC<AmRootRouteReadProps> = ({ route }) => {
  const styles = useStyles(getGridStyles);

  return (
    <div className={styles.container}>
      <div className={styles.titleCell}>Receiver channel</div>
      <div className={styles.valueCell}>{route?.receiver ?? '-'}</div>
      <div className={styles.titleCell}>Group by</div>
      <div className={styles.valueCell}>{(route?.group_by ?? []).join(', ') || '-'}</div>
      <div className={styles.titleCell}>Timings</div>
      <div className={styles.valueCell}>
        Group wait: {route?.group_wait ?? '-'} | Group interval: {route?.group_interval ?? '-'} | Repeat interval:{' '}
        {route?.repeat_interval ?? '-'}
      </div>
    </div>
  );
};
