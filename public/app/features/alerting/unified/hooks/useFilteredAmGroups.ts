import { useMemo } from 'react';

import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { AlertmanagerGroup } from 'app/plugins/datasource/alertmanager/types';

import { labelsMatchMatchers } from '../utils/alertmanager';
import { parsePromQLStyleMatcherLooseSafe } from '../utils/matchers';
import { getFiltersFromUrlParams } from '../utils/misc';

export const useFilteredAmGroups = (groups: AlertmanagerGroup[]) => {
  const [queryParams] = useQueryParams();
  const { queryString, alertState, receiver } = getFiltersFromUrlParams(queryParams);

  return useMemo(() => {
    const matchers = queryString ? parsePromQLStyleMatcherLooseSafe(queryString) : [];

    return groups.reduce((filteredGroup: AlertmanagerGroup[], group) => {
      // Filter by receiver if specified
      const receiverMatches = receiver && receiver.length > 0 ? receiver.includes(group.receiver.name) : true;

      if (!receiverMatches) {
        return filteredGroup;
      }

      const alerts = group.alerts.filter(({ labels, status }) => {
        const labelsMatch = labelsMatchMatchers(labels, matchers);
        const filtersMatch = alertState ? status.state === alertState : true;
        return labelsMatch && filtersMatch;
      });
      if (alerts.length > 0) {
        // The ungrouped alerts should be first in the results
        if (Object.keys(group.labels).length === 0) {
          filteredGroup.unshift({ ...group, alerts });
        } else {
          filteredGroup.push({ ...group, alerts });
        }
      }
      return filteredGroup;
    }, []);
  }, [queryString, groups, alertState, receiver]);
};
