import { isEmpty } from 'lodash';

import { type CombinedRule } from '../../../../types/unified-alerting';
import { type Labels } from '../../../../types/unified-alerting-dto';
import { type Label } from '../components/rules/state-history/common';

import { GRAFANA_FOLDER_LABEL, MATCHER_ALERT_RULE_UID } from './constants';
import { isGrafanaRulesSource } from './datasource';

export function labelsToTags(labels: Labels) {
  return Object.entries(labels)
    .map(([label, value]) => `${label}=${value}`)
    .sort();
}

export function objectLabelsToArray(labels: Labels): Label[] {
  return Object.entries(labels);
}

export function arrayLabelsToObject(labels: Label[]): Labels {
  const labelsObject: Labels = {};
  labels.forEach((label: Label) => {
    labelsObject[label[0]] = label[1];
  });
  return labelsObject;
}

export function arrayKeyValuesToObject(
  labels: Array<{
    key: string;
    value: string;
  }>
): Labels {
  const labelsObject: Labels = {};
  labels.forEach((label) => {
    label.key && (labelsObject[label.key] = label.value);
  });

  return labelsObject;
}

export const GRAFANA_ORIGIN_LABEL = '__grafana_origin';

export function labelsSize(labels?: Labels) {
  if (isEmpty(labels)) {
    return 0;
  }

  return Object.keys(labels).filter((key) => !isPrivateLabelKey(key)).length;
}

export function isPrivateLabelKey(labelKey: string) {
  return (labelKey.startsWith('__') && labelKey.endsWith('__')) || labelKey === GRAFANA_ORIGIN_LABEL;
}

export const isPrivateLabel = ([key, _]: [string, string]) => isPrivateLabelKey(key);

/**
 * Returns the full effective label set for a Grafana-managed alert rule, merging
 * user-defined labels with the system labels Grafana attaches to every fired
 * alert instance at evaluation time (alertname, grafana_folder, __alert_rule_uid__).
 *
 * User-defined labels take precedence over system labels if they conflict,
 * matching Go backend behavior (GetRuleExtraLabels).
 *
 * For non-Grafana rules sources, only the user-defined labels are returned since
 * system labels are not predictable from the rule definition alone.
 *
 * Note: labels derived from metric query results (e.g. `instance`, `job`) are
 * unknowable at rule-definition time and cannot be included.
 */
export function getEffectiveRuleLabels(rule: CombinedRule): Labels {
  if (!isGrafanaRulesSource(rule.namespace.rulesSource)) {
    return rule.labels;
  }

  const systemLabels: Labels = {
    alertname: rule.name,
    [GRAFANA_FOLDER_LABEL]: rule.namespace.name,
  };

  if (rule.uid) {
    systemLabels[MATCHER_ALERT_RULE_UID] = rule.uid;
  }

  // System labels are the base; user-defined labels override them, matching Go backend behavior.
  return { ...systemLabels, ...rule.labels };
}
