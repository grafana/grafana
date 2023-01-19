import { pick } from 'lodash';
import React, { FC } from 'react';

import { SelectableValue } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { InlineField, Select } from '@grafana/ui';
import { Receiver, RouteWithID } from 'app/plugins/datasource/alertmanager/types';

interface NotificationPoliciesFilterProps {
  receivers: Receiver[];
  onChangeLabels: (labels: string[]) => void;
  onChangeReceiver: (receiver: string) => void;
}

const NotificationPoliciesFilter: FC<NotificationPoliciesFilterProps> = ({
  receivers,
  onChangeReceiver,
  onChangeLabels,
}) => {
  const receiverOptions: Array<SelectableValue<string>> = receivers.map((receiver) => ({
    label: receiver.name,
    value: receiver.name,
  }));

  return (
    <Stack direction="row" alignItems="center">
      <InlineField label="Contact Point">
        <Select
          id="receiver"
          options={receiverOptions}
          onChange={(option) => onChangeReceiver(option?.value ?? '')}
          width={24}
          isClearable
        />
      </InlineField>
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

export { NotificationPoliciesFilter, findRoutesMatchingFilter };
