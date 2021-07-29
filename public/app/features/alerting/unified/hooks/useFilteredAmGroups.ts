import { AlertmanagerGroup, AlertState, Matcher } from 'app/plugins/datasource/alertmanager/types';
import { useMemo } from 'react';
import { labelsMatchMatchers } from '../utils/alertmanager';

export const useFilteredAmGroups = (groups: AlertmanagerGroup[], matchers: Matcher[], stateFilter?: AlertState) => {
  return useMemo(() => {
    return groups.reduce((filteredGroup, group) => {
      const alerts = group.alerts.filter(({ labels, status }) =>
        labelsMatchMatchers(labels, matchers) && stateFilter ? status.state === stateFilter : true
      );
      if (alerts.length > 0) {
        const newGroup = { ...group, alerts };
        filteredGroup.push(newGroup);
      }
      return filteredGroup;
    }, [] as AlertmanagerGroup[]);
  }, [groups, matchers, stateFilter]);
};
