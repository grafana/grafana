import { css } from '@emotion/css';
import { debounce, isEqual } from 'lodash';
import React, { useCallback, useEffect, useRef } from 'react';

import { SelectableValue } from '@grafana/data';
import { Button, Field, Icon, Input, Label, Select, Stack, Text, Tooltip, useStyles2 } from '@grafana/ui';
import { ObjectMatcher, Receiver, RouteWithID } from 'app/plugins/datasource/alertmanager/types';

import { useURLSearchParams } from '../../hooks/useURLSearchParams';
import { matcherToObjectMatcher, parseMatchers } from '../../utils/alertmanager';
import { normalizeMatchers } from '../../utils/matchers';

interface NotificationPoliciesFilterProps {
  receivers: Receiver[];
  onChangeMatchers: (labels: ObjectMatcher[]) => void;
  onChangeReceiver: (receiver: string | undefined) => void;
  matchingCount: number;
}

const NotificationPoliciesFilter = ({
  receivers,
  onChangeReceiver,
  onChangeMatchers,
  matchingCount,
}: NotificationPoliciesFilterProps) => {
  const [searchParams, setSearchParams] = useURLSearchParams();
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const { queryString, contactPoint } = getNotificationPoliciesFilters(searchParams);
  const styles = useStyles2(getStyles);

  const handleChangeLabels = useCallback(() => debounce(onChangeMatchers, 500), [onChangeMatchers]);

  useEffect(() => {
    onChangeReceiver(contactPoint);
  }, [contactPoint, onChangeReceiver]);

  useEffect(() => {
    const matchers = parseMatchers(queryString ?? '').map(matcherToObjectMatcher);
    handleChangeLabels()(matchers);
  }, [handleChangeLabels, queryString]);

  const clearFilters = useCallback(() => {
    if (searchInputRef.current) {
      searchInputRef.current.value = '';
    }
    setSearchParams({ contactPoint: undefined, queryString: undefined });
  }, [setSearchParams]);

  const receiverOptions: Array<SelectableValue<string>> = receivers.map(toOption);
  const selectedContactPoint = receiverOptions.find((option) => option.value === contactPoint) ?? null;

  const hasFilters = queryString || contactPoint;
  const inputInvalid = queryString && queryString.length > 3 ? parseMatchers(queryString).length === 0 : false;

  return (
    <Stack direction="row" alignItems="flex-end" gap={1}>
      <Field
        className={styles.noBottom}
        label={
          <Label>
            <Stack gap={0.5}>
              <span>Search by matchers</span>
              <Tooltip
                content={
                  <div>
                    Filter silences by matchers using a comma separated list of matchers, ie:
                    <pre>{`severity=critical, instance=~cluster-us-.+`}</pre>
                  </div>
                }
              >
                <Icon name="info-circle" size="sm" />
              </Tooltip>
            </Stack>
          </Label>
        }
        invalid={inputInvalid}
        error={inputInvalid ? 'Query must use valid matcher syntax' : null}
      >
        <Input
          ref={searchInputRef}
          data-testid="search-query-input"
          placeholder="Search"
          width={46}
          prefix={<Icon name="search" />}
          onChange={(event) => {
            setSearchParams({ queryString: event.currentTarget.value });
          }}
          defaultValue={queryString}
        />
      </Field>
      <Field label="Search by contact point" style={{ marginBottom: 0 }}>
        <Select
          id="receiver"
          aria-label="Search by contact point"
          value={selectedContactPoint}
          options={receiverOptions}
          onChange={(option) => {
            setSearchParams({ contactPoint: option?.value });
          }}
          width={28}
          isClearable
        />
      </Field>
      {hasFilters && (
        <Stack alignItems="center">
          <Button variant="secondary" icon="times" onClick={clearFilters}>
            Clear filters
          </Button>
          <Text variant="bodySmall" color="secondary">
            {matchingCount === 0 && 'No policies matching filters.'}
            {matchingCount === 1 && `${matchingCount} policy matches the filters.`}
            {matchingCount > 1 && `${matchingCount} policies match the filters.`}
          </Text>
        </Stack>
      )}
    </Stack>
  );
};

/**
 * Find a list of route IDs that match given input filters
 */
type FilterPredicate = (route: RouteWithID) => boolean;

/**
 * Find routes int the tree that match the given predicate function
 * @param routeTree the route tree to search
 * @param predicateFn the predicate function to match routes
 * @returns
 * - matches: list of routes that match the predicate
 * - matchingRouteIdsWithPath: map with routeids that are part of the path of a matching route
 *  key is the route id, value is an array of route ids that are part of its path
 */
export function findRoutesMatchingPredicate(
  routeTree: RouteWithID,
  predicateFn: FilterPredicate
): Map<RouteWithID, RouteWithID[]> {
  // map with routids that are part of the path of a matching route
  // key is the route id, value is an array of route ids that are part of the path
  const matchingRouteIdsWithPath = new Map<RouteWithID, RouteWithID[]>();

  function findMatch(route: RouteWithID, path: RouteWithID[]) {
    const newPath = [...path, route];

    if (predicateFn(route)) {
      // if the route matches the predicate, we need to add the path to the map of matching routes
      const previousPath = matchingRouteIdsWithPath.get(route) ?? [];
      // add the current route id to the map with its path
      matchingRouteIdsWithPath.set(route, [...previousPath, ...newPath]);
    }

    // if the route has subroutes, call findMatch recursively
    route.routes?.forEach((route) => findMatch(route, newPath));
  }

  findMatch(routeTree, []);

  return matchingRouteIdsWithPath;
}

export function findRoutesByMatchers(route: RouteWithID, labelMatchersFilter: ObjectMatcher[]): boolean {
  const routeMatchers = normalizeMatchers(route);

  return labelMatchersFilter.every((filter) => routeMatchers.some((matcher) => isEqual(filter, matcher)));
}

const toOption = (receiver: Receiver) => ({
  label: receiver.name,
  value: receiver.name,
});

const getNotificationPoliciesFilters = (searchParams: URLSearchParams) => ({
  queryString: searchParams.get('queryString') ?? undefined,
  contactPoint: searchParams.get('contactPoint') ?? undefined,
});

const getStyles = () => ({
  noBottom: css({
    marginBottom: 0,
  }),
});

export { NotificationPoliciesFilter };
