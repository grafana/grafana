import { css } from '@emotion/css';
import { pick } from 'lodash';
import React, { FC, useCallback, useEffect, useRef } from 'react';

import { SelectableValue } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Button, Field, Icon, Input, Label as LabelElement, Select, Tooltip, useStyles2 } from '@grafana/ui';
import { Receiver, RouteWithID } from 'app/plugins/datasource/alertmanager/types';

import { useURLSearchParams } from '../../hooks/useURLSearchParams';
import { parseMatchers } from '../../utils/alertmanager';
import { Label } from '../../utils/notification-policies';

interface NotificationPoliciesFilterProps {
  receivers: Receiver[];
  onChangeLabels: (labels: Label[] | undefined) => void;
  onChangeReceiver: (receiver: string | undefined) => void;
}

const NotificationPoliciesFilter: FC<NotificationPoliciesFilterProps> = ({
  receivers,
  onChangeReceiver,
  onChangeLabels,
}) => {
  const [searchParams, setSearchParams] = useURLSearchParams();
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const { queryString, contactPoint } = getNotificationPoliciesFilters(searchParams);
  const styles = useStyles2(getStyles);

  useEffect(() => {
    onChangeReceiver(contactPoint);
  }, [contactPoint, onChangeReceiver]);

  useEffect(() => {
    if (queryString) {
      const labels: Label[] = parseMatchers(queryString ?? '').map(({ name, value }) => [name, value]);
      onChangeLabels(labels.length > 0 ? labels : undefined);
    } else {
      onChangeLabels(undefined);
    }
  }, [onChangeLabels, queryString]);

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
    <Stack direction="row" alignItems="flex-start" gap={0.5}>
      <Field
        className={styles.noBottom}
        label={
          <LabelElement>
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
          </LabelElement>
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
        <Button variant="secondary" icon="times" onClick={clearFilters} style={{ marginTop: 19 }}>
          Clear filters
        </Button>
      )}
    </Stack>
  );
};

interface FilterState {
  receiver: string;
}

/**
 * Find a list of route IDs that match given input filters
 */
function findRoutesMatchingFilter(routeTree: RouteWithID, filters: FilterState): RouteWithID[] {
  const matches: RouteWithID[] = [];

  function findMatch(route: RouteWithID) {
    if (routeMatchesFilter(route, filters)) {
      matches.push(route);
    }

    route.routes?.forEach(findMatch);
  }

  findMatch(routeTree);
  return matches;
}

function routeMatchesFilter(route: RouteWithID, filters: FilterState) {
  if (filters.receiver) {
    return route.receiver === filters.receiver;
  }

  return false;
}

/**
 * This function will compute the full tree with inherited properties – this is mostly used for search and filtering
 */
export function computeInheritedTree(routeTree: RouteWithID): RouteWithID {
  return {
    ...routeTree,
    routes: routeTree.routes?.map((route) => {
      const inheritableProperties = pick(routeTree, [
        'receiver',
        'group_by',
        'group_wait',
        'group_interval',
        'repeat_interval',
        'mute_time_intervals',
      ]);

      return computeInheritedTree({
        ...inheritableProperties,
        ...route,
      });
    }),
  };
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
  noBottom: css`
    margin-bottom: 0;
  `,
});

export { NotificationPoliciesFilter, findRoutesMatchingFilter };
