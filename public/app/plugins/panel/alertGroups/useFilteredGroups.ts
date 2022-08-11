import { useMemo } from 'react';

import { labelsMatchMatchers } from 'app/features/alerting/unified/utils/alertmanager';
import { AlertmanagerGroup, Matcher } from 'app/plugins/datasource/alertmanager/types';

export const useFilteredGroups = (groups: AlertmanagerGroup[], matchers: Matcher[]): AlertmanagerGroup[] => {
  return useMemo(() => {
    return groups.filter((group) => {
      return (
        labelsMatchMatchers(group.labels, matchers) ||
        group.alerts.some((alert) => labelsMatchMatchers(alert.labels, matchers))
      );
    });
  }, [groups, matchers]);
};
