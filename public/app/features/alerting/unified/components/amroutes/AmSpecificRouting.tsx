import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Button, Icon, Input, Label, useStyles2 } from '@grafana/ui';
import { intersectionWith, isEqual } from 'lodash';
import React, { FC, useEffect, useState } from 'react';
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

const getFilteredRoutes = (routes: FormAmRoute[], labelMatcherQuery?: string, contactPointQuery?: string) => {
  const matchers = parseMatchers(labelMatcherQuery ?? '');

  let filteredRoutes = routes;

  if (matchers.length) {
    filteredRoutes = routes.filter((route) => {
      const routeMatchers = route.object_matchers.map(matcherFieldToMatcher);
      return intersectionWith(routeMatchers, matchers, isEqual).length > 0;
    });
  }

  if (contactPointQuery && contactPointQuery.length > 0) {
    filteredRoutes = filteredRoutes.filter((route) =>
      route.receiver.toLowerCase().includes(contactPointQuery.toLowerCase())
    );
  }

  return filteredRoutes;
};

export const AmSpecificRouting: FC<AmSpecificRoutingProps> = ({
  onChange,
  onRootRouteEdit,
  receivers,
  routes,
  readOnly = false,
}) => {
  const [actualRoutes, setActualRoutes] = useState([...routes.routes]);
  const [isAddMode, setIsAddMode] = useState(false);
  const [searchParams, setSearchParams] = useURLSearchParams();
  const { queryString, contactPoint } = getNotificationPoliciesFilters(searchParams);

  const styles = useStyles2(getStyles);

  useEffect(() => {
    if (!isAddMode) {
      const filtered = getFilteredRoutes(routes.routes, queryString, contactPoint);
      setActualRoutes(filtered);
    }
  }, [routes.routes, isAddMode, queryString, contactPoint]);

  const clearFilters = () => {
    setSearchParams({ queryString: undefined, contactPoint: undefined });
  };

  const addNewRoute = () => {
    clearFilters();
    setIsAddMode(true);
    setActualRoutes((actualRoutes) => [
      ...routes.routes,
      {
        ...emptyRoute,
        matchers: [emptyArrayFieldMatcher],
      },
    ]);
  };

  const onCancelAdd = () => {
    setIsAddMode(false);
    setActualRoutes([...routes.routes]);
  };

  const onTableRouteChange = (newRoutes: FormAmRoute[]): void => {
    onChange({
      ...routes,
      routes: newRoutes,
    });

    if (isAddMode) {
      setIsAddMode(false);
    }
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
      ) : routes.routes.length > 0 ? (
        <>
          <div>
            {!isAddMode && (
              <div className={styles.searchContainer}>
                <MatcherFilter
                  onFilterChange={(filter) => setSearchParams({ queryString: filter }, true)}
                  queryString={queryString ?? ''}
                  className={styles.filterInput}
                />{' '}
                <div className={styles.filterInput}>
                  <Label>Search by contact point</Label>
                  <Input
                    onChange={(e) => setSearchParams({ contactPoint: e.currentTarget.value }, true)}
                    value={contactPoint ?? ''}
                    placeholder="Search by contact point"
                    data-testid="search-query-input"
                    prefix={<Icon name={'search'} />}
                  />
                </div>
                {(queryString || contactPoint) && (
                  <Button variant="secondary" icon="times" onClick={clearFilters} className={styles.clearFilterBtn}>
                    Clear filters
                  </Button>
                )}
              </div>
            )}

            {!isAddMode && !readOnly && (
              <div className={styles.addMatcherBtnRow}>
                <Button className={styles.addMatcherBtn} icon="plus" onClick={addNewRoute} type="button">
                  New policy
                </Button>
              </div>
            )}
          </div>
          {actualRoutes.length > 0 ? (
            <AmRoutesTable
              isAddMode={isAddMode}
              readOnly={readOnly}
              onCancelAdd={onCancelAdd}
              onChange={onTableRouteChange}
              receivers={receivers}
              routes={actualRoutes}
            />
          ) : (
            <EmptyArea>
              <p>No policies found</p>
            </EmptyArea>
          )}
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
      padding-bottom: ${theme.spacing(2)};
      border-bottom: 1px solid ${theme.colors.border.strong};
    `,
    clearFilterBtn: css`
      align-self: flex-end;
      margin-left: ${theme.spacing(1)};
    `,
    filterInput: css`
      width: 340px;
      & + & {
        margin-left: ${theme.spacing(1)};
      }
    `,
    addMatcherBtnRow: css`
      display: flex;
      flex-flow: column nowrap;
      padding: ${theme.spacing(2)} 0;
    `,
    addMatcherBtn: css`
      align-self: flex-end;
    `,
  };
};
