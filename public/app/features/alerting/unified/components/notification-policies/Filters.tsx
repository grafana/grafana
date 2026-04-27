import { compact, isEqual } from 'lodash';
import { useCallback, useEffect, useMemo } from 'react';
import { useDebounce } from 'react-use';

import {
  ContactPointSelector as GrafanaManagedContactPointSelector,
  RoutingTreeSelector,
} from '@grafana/alerting/unstable';
import { type RoutingTree } from '@grafana/api-clients/rtkq/notifications.alerting/v0alpha1';
import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Button, Field, Input, Label, Stack, Tooltip } from '@grafana/ui';
import { Icon } from '@grafana/ui/components/icons';
import { AlertmanagerAction, useAlertmanagerAbility } from 'app/features/alerting/unified/hooks/useAbilities';
import { type ObjectMatcher, type RouteWithID } from 'app/plugins/datasource/alertmanager/types';

import { useURLSearchParams } from '../../hooks/useURLSearchParams';
import { useAlertmanager } from '../../state/AlertmanagerContext';
import { matcherToObjectMatcher } from '../../utils/alertmanager';
import {
  normalizeMatchers,
  parsePromQLStyleMatcherLoose,
  parsePromQLStyleMatcherLooseSafe,
  unquoteIfRequired,
} from '../../utils/matchers';

import { ExternalAlertmanagerContactPointSelector } from './ContactPointSelector';

interface NotificationPoliciesFilterProps {
  onChangeMatchers: (labels: ObjectMatcher[]) => void;
  onChangeReceiver: (receiver: string | undefined) => void;
}

const NotificationPoliciesFilter = ({ onChangeReceiver, onChangeMatchers }: NotificationPoliciesFilterProps) => {
  const [contactPointsSupported, canSeeContactPoints] = useAlertmanagerAbility(AlertmanagerAction.ViewContactPoint);
  const { isGrafanaAlertmanager } = useAlertmanager();
  const [searchParams, setSearchParams] = useURLSearchParams();
  const { queryString, contactPoint } = getNotificationPoliciesFilters(searchParams);
  const { hasFilters, clearFilters, selectedPolicyTreeNames } = useNotificationPoliciesFilters();

  const matchers = useMemo(
    () => parsePromQLStyleMatcherLooseSafe(queryString ?? '').map(matcherToObjectMatcher),
    [queryString]
  );

  useDebounce(
    () => {
      onChangeMatchers(matchers);
    },
    500,
    [matchers, onChangeMatchers]
  );

  useEffect(() => {
    onChangeReceiver(contactPoint);
  }, [contactPoint, onChangeReceiver]);

  const handlePolicyTreeFilterChange = useCallback(
    (trees: RoutingTree[]) => {
      const names = compact(trees.map((tree) => tree.metadata.name));
      setSearchParams({ includeTree: names.length > 0 ? names : undefined });
    },
    [setSearchParams]
  );

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
        noMargin
        label={
          <Label>
            <Stack gap={0.5}>
              <Trans i18nKey="alerting.common.search-by-matchers">Search by matchers</Trans>
              <Tooltip
                content={
                  <Trans i18nKey="alerting.policies.filter-description">
                    Filter routes by using a comma separated list of matchers, e.g.:
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
          data-testid="search-query-input"
          placeholder={t('alerting.notification-policies-filter.search-query-input-placeholder-search', 'Search')}
          width={46}
          prefix={<Icon name="search" />}
          onChange={(event) => {
            setSearchParams({ queryString: event.currentTarget.value });
          }}
          value={queryString ?? ''}
        />
      </Field>
      {contactPointsSupported && canSeeContactPoints && (
        <Field
          label={t('alerting.notification-policies-filter.label-search-by-contact-point', 'Contact point')}
          noMargin
        >
          {isGrafanaAlertmanager ? (
            <GrafanaManagedContactPointSelector
              placeholder={t(
                'alerting.notification-policies-filter.placeholder-search-by-contact-point',
                'Choose a contact point'
              )}
              id="receiver"
              onChange={(contactPoint) => {
                // clearing the contact point will return "null"
                if (!contactPoint) {
                  setSearchParams({ contactPoint: undefined });
                } else {
                  setSearchParams({ contactPoint: contactPoint.spec.title });
                }
              }}
              width={28}
              isClearable
              value={searchParams.get('contactPoint') ?? undefined}
            />
          ) : (
            <ExternalAlertmanagerContactPointSelector
              selectProps={{
                id: 'receiver',
                'aria-label': 'Search by contact point',
                onChange: (option) => {
                  setSearchParams({ contactPoint: option?.value?.name });
                },
                width: 28,
                isClearable: true,
                placeholder: t(
                  'alerting.notification-policies-filter.placeholder-search-by-contact-point',
                  'Choose a contact point'
                ),
              }}
              selectedContactPointName={searchParams.get('contactPoint') ?? undefined}
            />
          )}
        </Field>
      )}
      {isGrafanaAlertmanager && config.featureToggles.alertingMultiplePolicies && (
        <Field label={t('alerting.multiple-policies-view.policy-tree-filter-label', 'Policy')} noMargin>
          <RoutingTreeSelector
            multi
            value={selectedPolicyTreeNames}
            onChange={handlePolicyTreeFilterChange}
            placeholder={t('alerting.multiple-policies-view.policy-tree-filter-placeholder', 'Select policy trees')}
            width={40}
          />
        </Field>
      )}
      {hasFilters && (
        <Button variant="secondary" icon="times" onClick={clearFilters}>
          <Trans i18nKey="alerting.common.clear-filters">Clear filters</Trans>
        </Button>
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

export function useNotificationPoliciesFilters() {
  const [searchParams, setSearchParams] = useURLSearchParams();
  const { queryString, contactPoint } = getNotificationPoliciesFilters(searchParams);

  const selectedPolicyTreeNames = useMemo(() => searchParams.getAll('includeTree').filter(Boolean), [searchParams]);

  const labelMatchers = useMemo(
    () => parsePromQLStyleMatcherLooseSafe(queryString ?? '').map(matcherToObjectMatcher),
    [queryString]
  );

  const hasFilters = Boolean(queryString || contactPoint || selectedPolicyTreeNames.length > 0);

  const clearFilters = useCallback(() => {
    setSearchParams({ contactPoint: undefined, queryString: undefined, includeTree: undefined });
  }, [setSearchParams]);

  return { hasFilters, clearFilters, selectedPolicyTreeNames, contactPoint, labelMatchers };
}

export { NotificationPoliciesFilter };
