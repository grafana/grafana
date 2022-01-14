import React, { FC, useMemo, useState } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Button, useStyles2 } from '@grafana/ui';
import { AmRouteReceiver, FormAmRoute } from '../../types/amroutes';
import { emptyArrayFieldMatcher, emptyRoute } from '../../utils/amroutes';
import { EmptyArea } from '../EmptyArea';
import { AmRoutesTable } from './AmRoutesTable';
import { EmptyAreaWithCTA } from '../EmptyAreaWithCTA';
import { MatcherFilter } from '../alert-groups/MatcherFilter';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { getFiltersFromUrlParams } from '../../utils/misc';
import { parseMatchers, matcherFieldToMatcher } from '../../utils/alertmanager';
import { intersectionWith, isEqual } from 'lodash';

export interface AmSpecificRoutingProps {
  onChange: (routes: FormAmRoute) => void;
  onRootRouteEdit: () => void;
  receivers: AmRouteReceiver[];
  routes: FormAmRoute;
  readOnly?: boolean;
}

const useFilteredRoutes = (routes: FormAmRoute[], filterQuery?: string) => {
  const matchers = parseMatchers(filterQuery ?? '');

  const filteredRoutes = useMemo(() => {
    return matchers.length > 0
      ? routes.filter((route) => {
          const routeMatchers = route.object_matchers.map(matcherFieldToMatcher);
          return intersectionWith(routeMatchers, matchers, isEqual).length > 0;
        })
      : routes;
  }, [matchers, routes]);

  return [filteredRoutes];
};

export const AmSpecificRouting: FC<AmSpecificRoutingProps> = ({
  onChange,
  onRootRouteEdit,
  receivers,
  routes,
  readOnly = false,
}) => {
  const [actualRoutes, setActualRoutes] = useState(routes.routes);
  const [isAddMode, setIsAddMode] = useState(false);
  const [queryParams, setQueryParams] = useQueryParams();
  const { queryString } = getFiltersFromUrlParams(queryParams);

  const [filteredRoutes] = useFilteredRoutes(actualRoutes, queryString);

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
          {/* TODO If working correctly move to a shared folder */}
          <div className={styles.searchContainer}>
            {!isAddMode && (
              <MatcherFilter
                onFilterChange={(filter) => setQueryParams({ queryString: filter })}
                queryString={queryString}
              />
            )}
            {!isAddMode && !readOnly && (
              <Button className={styles.addMatcherBtn} icon="plus" onClick={addNewRoute} type="button">
                New policy
              </Button>
            )}
          </div>
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
            routes={filteredRoutes}
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
    searchContainer: css`
      display: flex;
      flex-flow: row nowrap;
      justify-content: space-between;
    `,
    addMatcherBtn: css`
      align-self: flex-end;
      margin-bottom: ${theme.spacing(3.5)};
    `,
  };
};
