import { SelectableValue } from '@grafana/data';
import React, { FC, useState } from 'react';
import { Button, useStyles } from '@grafana/ui';
import { Receiver } from '../../../../../plugins/datasource/alertmanager/types';
import { AmRouteFormValues } from '../../types/amroutes';
import { emptyRoute } from '../../utils/amroutes';
import { AmRoutesTable } from './AmRoutesTable';
import { getGridStyles } from './gridStyles';

export interface AmRoutesExpandedReadProps {
  onChange: (routes: AmRouteFormValues) => void;
  receivers: Array<SelectableValue<Receiver['name']>>;
  routes: AmRouteFormValues;
}

export const AmRoutesExpandedRead: FC<AmRoutesExpandedReadProps> = ({ onChange, receivers, routes }) => {
  const styles = useStyles(getGridStyles);

  const groupWait = routes.groupWaitValue ? `${routes.groupWaitValue}${routes.groupWaitValueType.value}` : '-';
  const groupInterval = routes.groupIntervalValue
    ? `${routes.groupIntervalValue}${routes.groupIntervalValueType.value}`
    : '-';
  const repeatInterval = routes.repeatIntervalValue
    ? `${routes.repeatIntervalValue}${routes.repeatIntervalValueType.value}`
    : '-';

  const [subroutes, setSubroutes] = useState(routes.routes);
  const [isAddMode, setIsAddMode] = useState(false);

  return (
    <div className={styles.container}>
      <div className={styles.titleCell}>Group wait</div>
      <div className={styles.valueCell}>{groupWait}</div>
      <div className={styles.titleCell}>Group interval</div>
      <div className={styles.valueCell}>{groupInterval}</div>
      <div className={styles.titleCell}>Repeat interval</div>
      <div className={styles.valueCell}>{repeatInterval}</div>
      <div className={styles.titleCell}>Nested policies</div>
      <div className={styles.valueCell}>
        <AmRoutesTable
          isAddMode={isAddMode}
          onChange={(newRoutes) => {
            onChange({
              ...routes,
              routes: newRoutes,
            });

            if (isAddMode) {
              setIsAddMode(false);
            }
          }}
          receivers={receivers}
          routes={subroutes}
        />
        <Button
          icon="plus"
          onClick={() => {
            setSubroutes((subroutes) => [...subroutes, emptyRoute]);
            setIsAddMode(true);
          }}
          type="button"
        >
          Add nested policy
        </Button>
      </div>
    </div>
  );
};
