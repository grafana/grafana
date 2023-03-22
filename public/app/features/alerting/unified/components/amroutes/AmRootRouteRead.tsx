import React, { FC } from 'react';

import { useStyles2 } from '@grafana/ui';

import { FormAmRoute } from '../../types/amroutes';

import { getGridStyles } from './gridStyles';

export interface AmRootRouteReadProps {
  routes: FormAmRoute;
}

export const AmRootRouteRead: FC<AmRootRouteReadProps> = ({ routes }) => {
  const styles = useStyles2(getGridStyles);

  const receiver = routes.receiver || '-';
  const groupBy = routes.groupBy.join(', ') || '-';
  const groupWait = routes.groupWaitValue || '-';
  const groupInterval = routes.groupIntervalValue || '-';
  const repeatInterval = routes.repeatIntervalValue || '-';

  return (
    <div className={styles.container}>
      <div className={styles.titleCell}>Contact point</div>
      <div className={styles.valueCell} data-testid="am-routes-root-receiver">
        {receiver}
      </div>
      <div className={styles.titleCell}>Group by</div>
      <div className={styles.valueCell} data-testid="am-routes-root-group-by">
        {groupBy}
      </div>
      <div className={styles.titleCell}>Timings</div>
      <div className={styles.valueCell} data-testid="am-routes-root-timings">
        Group wait: {groupWait} | Group interval: {groupInterval} | Repeat interval: {repeatInterval}
      </div>
    </div>
  );
};
