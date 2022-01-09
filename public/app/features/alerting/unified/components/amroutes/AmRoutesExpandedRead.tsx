import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import React, { FC, useState } from 'react';
import { Button, useStyles2 } from '@grafana/ui';
import { AmRouteReceiver, FormAmRoute } from '../../types/amroutes';
import { emptyRoute } from '../../utils/amroutes';
import { AmRoutesTable } from './AmRoutesTable';
import { getGridStyles } from './gridStyles';
import { MuteTimingsTable } from './MuteTimingsTable';
import { useAlertManagerSourceName } from '../../hooks/useAlertManagerSourceName';

export interface AmRoutesExpandedReadProps {
  onChange: (routes: FormAmRoute) => void;
  receivers: AmRouteReceiver[];
  routes: FormAmRoute;
  readOnly?: boolean;
}

export const AmRoutesExpandedRead: FC<AmRoutesExpandedReadProps> = ({
  onChange,
  receivers,
  routes,
  readOnly = false,
}) => {
  const styles = useStyles2(getStyles);
  const gridStyles = useStyles2(getGridStyles);
  const [alertManagerSourceName] = useAlertManagerSourceName();

  const groupWait = routes.groupWaitValue ? `${routes.groupWaitValue}${routes.groupWaitValueType}` : '-';
  const groupInterval = routes.groupIntervalValue
    ? `${routes.groupIntervalValue}${routes.groupIntervalValueType}`
    : '-';
  const repeatInterval = routes.repeatIntervalValue
    ? `${routes.repeatIntervalValue}${routes.repeatIntervalValueType}`
    : '-';

  const [subroutes, setSubroutes] = useState(routes.routes);
  const [isAddMode, setIsAddMode] = useState(false);

  return (
    <div className={gridStyles.container}>
      <div className={gridStyles.titleCell}>Group wait</div>
      <div className={gridStyles.valueCell}>{groupWait}</div>
      <div className={gridStyles.titleCell}>Group interval</div>
      <div className={gridStyles.valueCell}>{groupInterval}</div>
      <div className={gridStyles.titleCell}>Repeat interval</div>
      <div className={gridStyles.valueCell}>{repeatInterval}</div>
      <div className={gridStyles.titleCell}>Nested policies</div>
      <div className={gridStyles.valueCell}>
        {!!subroutes.length ? (
          <AmRoutesTable
            isAddMode={isAddMode}
            onCancelAdd={() => {
              setIsAddMode(false);
              setSubroutes((subroutes) => {
                const newSubroutes = [...subroutes];
                newSubroutes.pop();

                return newSubroutes;
              });
            }}
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
        ) : (
          <p>No nested policies configured.</p>
        )}
        {!isAddMode && !readOnly && (
          <Button
            className={styles.addNestedRoutingBtn}
            icon="plus"
            onClick={() => {
              setSubroutes((subroutes) => [...subroutes, emptyRoute]);
              setIsAddMode(true);
            }}
            variant="secondary"
            type="button"
          >
            Add nested policy
          </Button>
        )}
      </div>
      <div className={gridStyles.titleCell}>Mute timings</div>
      <div className={gridStyles.valueCell}>
        <MuteTimingsTable
          alertManagerSourceName={alertManagerSourceName!}
          muteTimingNames={routes.muteTimeIntervals}
          hideActions
        />
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    addNestedRoutingBtn: css`
      margin-top: ${theme.spacing(2)};
    `,
  };
};
