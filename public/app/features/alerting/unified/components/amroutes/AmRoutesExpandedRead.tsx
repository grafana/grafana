import { SelectableValue } from '@grafana/data';
import React, { FC } from 'react';
import { useStyles } from '@grafana/ui';
import { Receiver, Route } from 'app/plugins/datasource/alertmanager/types';
import { AmRoutesTable } from './AmRoutesTable';
import { getGridStyles } from './gridStyles';

export interface AmRoutesExpandedReadProps {
  route: Route;
  receivers: Array<SelectableValue<Receiver['name']>>;
}

export const AmRoutesExpandedRead: FC<AmRoutesExpandedReadProps> = ({ route, receivers }) => {
  const styles = useStyles(getGridStyles);

  return (
    <div className={styles.container}>
      <div className={styles.titleCell}>Group wait</div>
      <div className={styles.valueCell}>{route.group_wait ?? '-'}</div>
      <div className={styles.titleCell}>Repeat interval</div>
      <div className={styles.valueCell}>{route.repeat_interval ?? '-'}</div>
      <div className={styles.titleCell}>Nested policies</div>
      <div className={styles.valueCell}>
        {route.routes?.length ? <AmRoutesTable routes={route.routes ?? []} receivers={receivers} /> : '-'}
      </div>
    </div>
  );
};
