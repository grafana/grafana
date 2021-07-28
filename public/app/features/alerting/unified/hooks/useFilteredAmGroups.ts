import { AlertmanagerGroup, Matcher } from 'app/plugins/datasource/alertmanager/types';
import { useMemo } from 'react';
import { labelsMatchMatchers } from '../utils/alertmanager';

export const useFilteredAmGroups = (groups: AlertmanagerGroup[], matchers: Matcher[]) => {
  return useMemo(() => {
    return groups.reduce((filteredGroup, group) => {
      const alerts = group.alerts.filter(({ labels }) => labelsMatchMatchers(labels, matchers));
      if (alerts.length > 0) {
        const newGroup = { ...group, alerts };
        filteredGroup.push(newGroup);
      }
      return filteredGroup;
    }, [] as AlertmanagerGroup[]);
  }, [groups, matchers]);
};
