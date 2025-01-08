import { css } from '@emotion/css';
import { debounce, isEqual } from 'lodash';
import { useCallback, useEffect, useRef } from 'react';

import { Button, Field, Icon, Input, Label, Stack, Text, Tooltip, useStyles2 } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';
import { ContactPointSelector } from 'app/features/alerting/unified/components/notification-policies/ContactPointSelector';
import { AlertmanagerAction, useAlertmanagerAbility } from 'app/features/alerting/unified/hooks/useAbilities';
import { ObjectMatcher, RouteWithID } from 'app/plugins/datasource/alertmanager/types';

import { useURLSearchParams } from '../../hooks/useURLSearchParams';
import { matcherToObjectMatcher } from '../../utils/alertmanager';
import {
  normalizeMatchers,
  parsePromQLStyleMatcherLoose,
  parsePromQLStyleMatcherLooseSafe,
  unquoteIfRequired,
} from '../../utils/matchers';

interface NotificationPoliciesFilterProps {
  onChangeMatchers: (labels: ObjectMatcher[]) => void;
  onChangeReceiver: (receiver: string | undefined) => void;
  matchingCount: number;
}

const NotificationPoliciesFilter = ({
  onChangeReceiver,
  onChangeMatchers,
  matchingCount,
}: NotificationPoliciesFilterProps) => {
  const [contactPointsSupported, canSeeContactPoints] = useAlertmanagerAbility(AlertmanagerAction.ViewContactPoint);
  const [searchParams, setSearchParams] = useURLSearchParams();
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const { queryString, contactPoint } = getNotificationPoliciesFilters(searchParams);
  const styles = useStyles2(getStyles);

  const handleChangeLabels = useCallback(() => debounce(onChangeMatchers, 500), [onChangeMatchers]);

  useEffect(() => {
    onChangeReceiver(contactPoint);
  }, [contactPoint, onChangeReceiver]);

  useEffect(() => {
    const matchers = parsePromQLStyleMatcherLooseSafe(queryString ?? '').map(matcherToObjectMatcher);
    handleChangeLabels()(matchers);
  }, [handleChangeLabels, queryString]);

  const clearFilters = useCallback(() => {
    if (searchInputRef.current) {
      searchInputRef.current.value = '';
    }
    setSearchParams({ contactPoint: '', queryString: undefined });
  }, [setSearchParams]);

  const hasFilters = queryString || contactPoint;

  let inputValid = Boolean(queryString && queryString.length > 3);
  try {
    if (!queryString) {
      inputValid = true;
    } else {
      parsePromQLStyleMatcherLoose(queryString);
    }
  } catch (err) {
    inputValid = false;
  }

  return (
    <Stack direction="row" alignItems="flex-end" gap={1}>
      <Field
        className={styles.noBottom}
        label={
          <Label>
            <Stack gap={0.5}>
              <Trans i18nKey="alerting.common.search-by-matchers">Search by matchers</Trans>
              <Tooltip
                content={
                  <Trans i18nKey="alerting.policies.filter-description">
                    Filter notification policies by using a comma separated list of matchers, e.g.:
                    <pre>severity=critical, region=EMEA</pre>
                  </Trans>
                }
              >
                <Icon name="info-circle" size="sm" />
              </Tooltip>
            </Stack>
          </Label>
        }
        invalid={!inputValid}
        error={!inputValid ? 'Query must use valid matcher syntax' : null}
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
      {contactPointsSupported && canSeeContactPoints && (
        <Field label="Search by contact point" style={{ marginBottom: 0 }}>
          <ContactPointSelector
            selectProps={{
              id: 'receiver',
              'aria-label': 'Search by contact point',
              onChange: (option) => {
                setSearchParams({ contactPoint: option?.value?.name });
              },
              width: 28,
              isClearable: true,
            }}
            selectedContactPointName={searchParams.get('contactPoint') ?? undefined}
          />
        </Field>
      )}
      {hasFilters && (
        <Stack alignItems="center">
          <Button variant="secondary" icon="times" onClick={clearFilters}>
            <Trans i18nKey="alerting.common.clear-filters">Clear filters</Trans>
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
  const filters = labelMatchersFilter.map(unquoteMatchersIfRequired);
  const routeMatchers = normalizeMatchers(route).map(unquoteMatchersIfRequired);
  return filters.every((filter) => routeMatchers.some((matcher) => isEqual(filter, matcher)));
}

/**
 * This function is mostly used for decoding matchers like "test"="test" into test=test to remove quotes when they're not needed.
 * This mimicks the behaviour in Alertmanager where it decodes the label matchers in the same way and makes searching for policies
 * easier in case the label keys or values are quoted when they shouldn't really be.
 */
const unquoteMatchersIfRequired = ([key, operator, value]: ObjectMatcher): ObjectMatcher => {
  return [unquoteIfRequired(key), operator, unquoteIfRequired(value)];
};

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
