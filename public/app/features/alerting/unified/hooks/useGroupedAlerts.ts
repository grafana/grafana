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
        return groups.reduce<AlertmanagerGroup[]>((combinedGroups, group) => {
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
        }, []);
      } else {
        return groups;
      }
    }

    // api/v2/alerts/groups returns alerts grouped by labels AND receiver.
    // It means that the same alert can be in multiple groups if it has multiple receivers.
    // Hence, to get the list of unique alerts we need to get unique alerts by fingerprint.
    const alerts = uniqBy(
      groups.flatMap(({ alerts }) => alerts),
      (alert) => alert.fingerprint
    );
    return alerts.reduce<AlertmanagerGroup[]>((groupings, alert) => {
      const alertContainsGroupings = groupBy.every((groupByLabel) => Object.keys(alert.labels).includes(groupByLabel));

      if (alertContainsGroupings) {
        // We need to create a group for each receiver. This is how Alertmanager groups alerts.
        // Alertmanager not only does grouping by labels but also by receiver.
        const receiverAlertGroups = alert.receivers.map<AlertmanagerGroup>((receiver) => ({
          alerts: [alert],
          labels: groupBy.reduce<Labels>((acc, key) => {
            acc = { ...acc, [key]: alert.labels[key] };
            return acc;
          }, {}),
          receiver,
        }));

        // Merge the same groupings - groupings are the same if they have the same labels and receiver
        receiverAlertGroups.forEach((receiverAlertGroup) => {
          const existingGroup = groupings.find((grouping) => {
            return (
              Object.keys(receiverAlertGroup.labels).every(
                (key) => grouping.labels[key] === receiverAlertGroup.labels[key]
              ) && grouping.receiver.name === receiverAlertGroup.receiver.name
            );
          });

          if (existingGroup) {
            existingGroup.alerts.push(alert);
          } else {
            groupings.push(receiverAlertGroup);
          }
        });
      } else {
        const noGroupingGroup = groupings.find((group) => Object.keys(group.labels).length === 0);
        if (!noGroupingGroup) {
          groupings.push({ alerts: [alert], labels: {}, receiver: { name: 'NONE' } });
        } else {
          noGroupingGroup.alerts.push(alert);
        }
      }

      return groupings;
    }, []);
  }, [groups, groupBy]);
};
