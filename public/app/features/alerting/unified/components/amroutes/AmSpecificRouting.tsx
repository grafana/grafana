import React, { FC, useState } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme, SelectableValue } from '@grafana/data';
import { Button, useStyles } from '@grafana/ui';
import { Receiver } from 'app/plugins/datasource/alertmanager/types';
import { AmRouteFormValues } from '../../types/amroutes';
import { emptyRoute } from '../../utils/amroutes';
import { AmRoutesTable } from './AmRoutesTable';

export interface AmSpecificRoutingProps {
  onChange: (routes: AmRouteFormValues) => void;
  receivers: Array<SelectableValue<Receiver['name']>>;
  routes: AmRouteFormValues;
}

export const AmSpecificRouting: FC<AmSpecificRoutingProps> = ({ onChange, receivers, routes }) => {
  const [actualRoutes, setActualRoutes] = useState(routes.routes);
  const [isAddMode, setIsAddMode] = useState(false);

  const styles = useStyles(getStyles);

  return (
    <div className={styles.container}>
      <h5>Specific routing</h5>
      <p>Send specific alerts to chosen channels, based on matching criteria</p>
      <Button
        className={styles.addMatcherBtn}
        icon="plus"
        onClick={() => {
          setIsAddMode(true);
          setActualRoutes((actualRoutes) => [...actualRoutes, emptyRoute]);
        }}
        type="button"
      >
        New policy
      </Button>
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
        routes={actualRoutes}
      />
    </div>
  );
};

const getStyles = (_theme: GrafanaTheme) => {
  return {
    container: css`
      display: flex;
      flex-flow: column nowrap;
    `,
    addMatcherBtn: css`
      align-self: flex-end;
      margin-bottom: 28px;
    `,
  };
};
