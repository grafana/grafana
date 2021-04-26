import React, { FC } from 'react';
import { useStyles } from '@grafana/ui';
import { AmRouteFormValues } from '../../types/amroutes';
import { getGridStyles } from './gridStyles';

export interface AmRootRouteReadProps {
  routes: AmRouteFormValues;
}

export const AmRootRouteRead: FC<AmRootRouteReadProps> = ({ routes }) => {
  const styles = useStyles(getGridStyles);

  const receiver = routes.receiver?.value || '-';
  const groupBy = routes.groupBy.map((groupBy) => groupBy.label).join(', ') || '-';
  const groupWait = routes.groupWaitValue ? `${routes.groupWaitValue}${routes.groupWaitValueType.value}` : '-';
  const groupInterval = routes.groupIntervalValue
    ? `${routes.groupIntervalValue}${routes.groupIntervalValueType.value}`
    : '-';
  const repeatInterval = routes.repeatIntervalValue
    ? `${routes.repeatIntervalValue}${routes.repeatIntervalValueType.value}`
    : '-';

  return (
    <div className={styles.container}>
      <div className={styles.titleCell}>Receiver channel</div>
      <div className={styles.valueCell}>{receiver}</div>
      <div className={styles.titleCell}>Group by</div>
      <div className={styles.valueCell}>{groupBy}</div>
      <div className={styles.titleCell}>Timings</div>
      <div className={styles.valueCell}>
        Group wait: {groupWait} | Group interval: {groupInterval} | Repeat interval: {repeatInterval}
      </div>
    </div>
  );
};
