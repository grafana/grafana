import { uniqBy } from 'lodash';
import { useMemo } from 'react';

import { Labels } from '@grafana/data';
import { AlertmanagerGroup } from 'app/plugins/datasource/alertmanager/types';

export const useGroupedAlerts = (groups: AlertmanagerGroup[], groupBy: string[]): AlertmanagerGroup[] => {
  return useMemo(() => {
    if (groupBy.length === 0) {
      const emptyGroupings = groups.filter((group) => Object.keys(group.labels).length === 0);
      if (emptyGroupings.length > 1) {
        // Merges multiple ungrouped grouping
        return groups.reduce((combinedGroups, group) => {
          if (Object.keys(group.labels).length === 0) {
            const noGroupingGroup = combinedGroups.find(({ labels }) => Object.keys(labels));
            if (!noGroupingGroup) {
              combinedGroups.push({ alerts: group.alerts, labels: {}, receiver: { name: 'NONE' } });
            } else {
              noGroupingGroup.alerts = uniqBy([...noGroupingGroup.alerts, ...group.alerts], 'labels');
            }
          } else {
            combinedGroups.push(group);
          }
          return combinedGroups;
        }, [] as AlertmanagerGroup[]);
      } else {
        return groups;
      }
    }
    const alerts = groups.flatMap(({ alerts }) => alerts);
    return alerts.reduce((groupings, alert) => {
      const alertContainsGroupings = groupBy.every((groupByLabel) => Object.keys(alert.labels).includes(groupByLabel));

      if (alertContainsGroupings) {
        const existingGrouping = groupings.find((group) => {
          return groupBy.every((groupKey) => {
            return group.labels[groupKey] === alert.labels[groupKey];
          });
        });
        if (!existingGrouping) {
          const labels = groupBy.reduce((acc, key) => {
            acc = { ...acc, [key]: alert.labels[key] };
            return acc;
          }, {} as Labels);
          groupings.push({
            alerts: [alert],
            labels,
            receiver: {
              name: 'NONE',
            },
          });
        } else {
          existingGrouping.alerts.push(alert);
        }
      } else {
        const noGroupingGroup = groupings.find((group) => Object.keys(group.labels).length === 0);
        if (!noGroupingGroup) {
          groupings.push({ alerts: [alert], labels: {}, receiver: { name: 'NONE' } });
        } else {
          noGroupingGroup.alerts.push(alert);
        }
      }

      return groupings;
    }, [] as AlertmanagerGroup[]);
  }, [groups, groupBy]);
};
