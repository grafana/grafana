import React, { FC, useMemo } from 'react';
import { useStyles2 } from '@grafana/ui';
import { AlertLabel } from 'app/features/alerting/unified/components/AlertLabel';
import { AlertInstances } from '../AlertInstances';
import { GroupedRules, UnifiedAlertListOptions } from '../types';
import { getStyles } from '../UnifiedAlertList';
import { PromRuleWithLocation } from 'app/types/unified-alerting';

type GroupedModeProps = {
  rules: PromRuleWithLocation[];
  options: UnifiedAlertListOptions;
};

const GroupedModeView: FC<GroupedModeProps> = ({ rules, options }) => {
  const styles = useStyles2(getStyles);

  const groupBy = options.groupBy;

  const groupedRules = useMemo<GroupedRules>(() => {
    const groupedRules = new Map();

    const hasInstancesWithMatchingLabels = (rule: PromRuleWithLocation) =>
      groupBy ? alertHasEveryLabel(rule, groupBy) : true;

    const matchingRules = rules.filter(hasInstancesWithMatchingLabels);
    matchingRules.forEach((rule: PromRuleWithLocation) => {
      (rule.rule.alerts ?? []).forEach((alert) => {
        const mapKey = createMapKey(groupBy, alert.labels);
        const existingAlerts = groupedRules.get(mapKey) ?? [];
        groupedRules.set(mapKey, [...existingAlerts, alert]);
      });
    });

    return groupedRules;
  }, [groupBy, rules]);

  return (
    <>
      {Array.from(groupedRules).map(([key, alerts]) => (
        <li className={styles.alertRuleItem} key={key}>
          <div>
            <div className={styles.customGroupDetails}>
              <div className={styles.alertLabels}>
                {key && parseMapKey(key).map(([key, value]) => <AlertLabel key={key} labelKey={key} value={value} />)}
                {!key && 'No grouping'}
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

function alertHasEveryLabel(rule: PromRuleWithLocation, groupByKeys: string[]) {
  return groupByKeys.every((key) => {
    return (rule.rule.alerts ?? []).some((alert) => alert.labels[key]);
  });
}

export default GroupedModeView;
