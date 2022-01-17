import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Button, Icon, Input, Label, useStyles2 } from '@grafana/ui';
import { intersectionWith, isEqual } from 'lodash';
import React, { FC, useMemo, useState } from 'react';
import { useURLSearchParams } from '../../hooks/useURLSearchParams';
import { AmRouteReceiver, FormAmRoute } from '../../types/amroutes';
import { matcherFieldToMatcher, parseMatchers } from '../../utils/alertmanager';
import { emptyArrayFieldMatcher, emptyRoute } from '../../utils/amroutes';
import { getNotificationPoliciesFilters } from '../../utils/misc';
import { MatcherFilter } from '../alert-groups/MatcherFilter';
import { EmptyArea } from '../EmptyArea';
import { EmptyAreaWithCTA } from '../EmptyAreaWithCTA';
import { AmRoutesTable } from './AmRoutesTable';

export interface AmSpecificRoutingProps {
  onChange: (routes: FormAmRoute) => void;
  onRootRouteEdit: () => void;
  receivers: AmRouteReceiver[];
  routes: FormAmRoute;
  readOnly?: boolean;
}

const useFilteredRoutes = (routes: FormAmRoute[], labelMatcherQuery?: string, contactPointQuery?: string) => {
  const matchers = parseMatchers(labelMatcherQuery ?? '');

  const filteredRoutes = useMemo(() => {
    let filtered = routes;

    if (matchers.length) {
      filtered = routes.filter((route) => {
        const routeMatchers = route.object_matchers.map(matcherFieldToMatcher);
        return intersectionWith(routeMatchers, matchers, isEqual).length > 0;
      });
    }

    if (contactPointQuery && contactPointQuery.length > 0) {
      filtered = filtered.filter((route) => route.receiver.toLowerCase().includes(contactPointQuery.toLowerCase()));
    }

    return filtered;
  }, [matchers, routes, contactPointQuery]);

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
  const [searchParams, setSearchParams] = useURLSearchParams();
  const { queryString, contactPoint } = getNotificationPoliciesFilters(searchParams);

  const [filteredRoutes] = useFilteredRoutes(actualRoutes, queryString, contactPoint);

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
                onFilterChange={(filter) => setSearchParams({ queryString: filter })}
                queryString={queryString}
                className={styles.filterInput}
              />
            )}
            {!isAddMode && (
              <div className={styles.filterInput}>
                <Label>Search by contact point</Label>
                <Input
                  onChange={(e) => setSearchParams({ contactPoint: e.currentTarget.value })}
                  defaultValue={contactPoint}
                  placeholder="Search by contact point"
                  data-testid="search-query-input"
                  prefix={<Icon name={'search'} />}
                />
              </div>
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
      flex-flow: column wrap;
    `,
    searchContainer: css`
      display: flex;
      flex-flow: row nowrap;
      margin-bottom: ${theme.spacing(3.5)};
    `,
    filterInput: css`
      width: 340px;
      & + & {
        margin-left: ${theme.spacing(1)};
      }
    `,
    addMatcherBtn: css`
      align-self: flex-end;
      margin-left: auto;
    `,
  };
};
