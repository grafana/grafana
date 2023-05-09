import React, { useMemo } from 'react';

import { useStyles2 } from '@grafana/ui';
import { AlertLabel } from 'app/features/alerting/unified/components/AlertLabel';
import { getAlertingRule } from 'app/features/alerting/unified/utils/rules';
import { Alert } from 'app/types/unified-alerting';

import { CombinedRuleWithLocation } from '../../../../types/unified-alerting';
import { AlertInstances } from '../AlertInstances';
import { getStyles } from '../UnifiedAlertList';
import { GroupedRules, UnifiedAlertListOptions } from '../types';
import { filterAlerts } from '../util';

type Props = {
  rules: CombinedRuleWithLocation[];
  options: UnifiedAlertListOptions;
};

export const UNGROUPED_KEY = '__ungrouped__';

const GroupedModeView = ({ rules, options }: Props) => {
  const styles = useStyles2(getStyles);
  const groupBy = options.groupBy;

  const groupedRules = useMemo<GroupedRules>(() => {
    const groupedRules = new Map<string, Alert[]>();

    const hasInstancesWithMatchingLabels = (rule: CombinedRuleWithLocation) =>
      groupBy ? alertHasEveryLabelForCombinedRules(rule, groupBy) : true;

    rules.forEach((rule) => {
      const alertingRule = getAlertingRule(rule);
      const hasInstancesMatching = hasInstancesWithMatchingLabels(rule);

      (alertingRule?.alerts ?? []).forEach((alert) => {
        const mapKey = hasInstancesMatching ? createMapKey(groupBy, alert.labels) : UNGROUPED_KEY;

        const existingAlerts = groupedRules.get(mapKey) ?? [];
        groupedRules.set(mapKey, [...existingAlerts, alert]);
      });
    });

    // move the "UNGROUPED" key to the last item in the Map, items are shown in insertion order
    const ungrouped = groupedRules.get(UNGROUPED_KEY) ?? [];
    groupedRules.delete(UNGROUPED_KEY);
    groupedRules.set(UNGROUPED_KEY, ungrouped);

    // Remove groups having no instances
    // This is different from filtering Rules without instances that we do in UnifiedAlertList
    const filteredGroupedRules = Array.from(groupedRules.entries()).reduce((acc, [groupKey, groupAlerts]) => {
      const filteredAlerts = filterAlerts(options, groupAlerts);
      if (filteredAlerts.length > 0) {
        acc.set(groupKey, filteredAlerts);
      }

      return acc;
    }, new Map<string, Alert[]>());

    return filteredGroupedRules;
  }, [groupBy, rules, options]);

  return (
    <>
      {Array.from(groupedRules).map(([key, alerts]) => (
        <li className={styles.alertRuleItem} key={key} data-testid={key}>
          <div>
            <div className={styles.customGroupDetails}>
              <div className={styles.alertLabels}>
                {key !== UNGROUPED_KEY &&
                  parseMapKey(key).map(([key, value]) => <AlertLabel key={key} labelKey={key} value={value} />)}
                {key === UNGROUPED_KEY && 'No grouping'}
              </div>
            </div>
            <AlertInstances alerts={alerts} options={options} />
          </div>
        </li>
      ))}
    </>
  );
};

function createMapKey(groupBy: string[], labels: Record<string, string>): string {
  return new URLSearchParams(groupBy.map((key) => [key, labels[key]])).toString();
}

function parseMapKey(key: string): Array<[string, string]> {
  return [...new URLSearchParams(key)];
}

function alertHasEveryLabelForCombinedRules(rule: CombinedRuleWithLocation, groupByKeys: string[]) {
  const alertingRule = getAlertingRule(rule);
  return groupByKeys.every((key) => {
    return (alertingRule?.alerts ?? []).some((alert) => alert.labels[key]);
  });
}

export default GroupedModeView;
