import React, { FC, useState } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Button, useStyles2 } from '@grafana/ui';
import { AmRouteReceiver, FormAmRoute } from '../../types/amroutes';
import { emptyArrayFieldMatcher, emptyRoute } from '../../utils/amroutes';
import { EmptyArea } from '../EmptyArea';
import { AmRoutesTable } from './AmRoutesTable';
import { EmptyAreaWithCTA } from '../EmptyAreaWithCTA';

export interface AmSpecificRoutingProps {
  onChange: (routes: FormAmRoute) => void;
  onRootRouteEdit: () => void;
  receivers: AmRouteReceiver[];
  routes: FormAmRoute;
  readOnly?: boolean;
}

export const AmSpecificRouting: FC<AmSpecificRoutingProps> = ({
  onChange,
  onRootRouteEdit,
  receivers,
  routes,
  readOnly = false,
}) => {
  const [actualRoutes, setActualRoutes] = useState(routes.routes);
  const [isAddMode, setIsAddMode] = useState(false);

  const styles = useStyles2(getStyles);

  const addNewRoute = () => {
    setIsAddMode(true);
    setActualRoutes((actualRoutes) => [
      ...actualRoutes,
      {
        ...emptyRoute,
        matchers: [emptyArrayFieldMatcher],
      },
    ]);
  };

  return (
    <div className={styles.container}>
      <h5>Specific routing</h5>
      <p>Send specific alerts to chosen contact points, based on matching criteria</p>
      {!routes.receiver ? (
        readOnly ? (
          <EmptyArea>
            <p>There is no default contact point configured for the root route.</p>
          </EmptyArea>
        ) : (
          <EmptyAreaWithCTA
            buttonIcon="rocket"
            buttonLabel="Set a default contact point"
            onButtonClick={onRootRouteEdit}
            text="You haven't set a default contact point for the root route yet."
          />
        )
      ) : actualRoutes.length > 0 ? (
        <>
          {!isAddMode && !readOnly && (
            <Button className={styles.addMatcherBtn} icon="plus" onClick={addNewRoute} type="button">
              New policy
            </Button>
          )}
          <AmRoutesTable
            isAddMode={isAddMode}
            readOnly={readOnly}
            onCancelAdd={() => {
              setIsAddMode(false);
              setActualRoutes((actualRoutes) => {
                const newRoutes = [...actualRoutes];
                newRoutes.pop();

                return newRoutes;
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
            routes={actualRoutes}
          />
        </>
      ) : readOnly ? (
        <EmptyArea>
          <p>There are no specific policies configured.</p>
        </EmptyArea>
      ) : (
        <EmptyAreaWithCTA
          buttonIcon="plus"
          buttonLabel="New specific policy"
          onButtonClick={addNewRoute}
          text="You haven't created any specific policies yet."
        />
      )}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css`
      display: flex;
      flex-flow: column nowrap;
    `,
    addMatcherBtn: css`
      align-self: flex-end;
      margin-bottom: ${theme.spacing(3.5)};
    `,
  };
};
