import { type CloudRuleIdentifier, type PrometheusRuleIdentifier } from 'app/types/unified-alerting';

import { PROMETHEUS_ALERTING_APP_ID } from '../hooks/useDMAStatus';

import * as ruleId from './rule-id';

const baseUrl = `/a/${PROMETHEUS_ALERTING_APP_ID}`;

type PrometheusAlertingRuleIdentifier = CloudRuleIdentifier | PrometheusRuleIdentifier;

export const prometheusAlertingPlugin = {
  install: `/plugins/${PROMETHEUS_ALERTING_APP_ID}`,
  rules: `${baseUrl}/rules`,
  newRule: (type: 'alerting' | 'recording') => `${baseUrl}/rules/new?type=${type}`,
  viewRule: (identifier: PrometheusAlertingRuleIdentifier) =>
    `${baseUrl}/rules/${encodeURIComponent(ruleId.stringifyIdentifier(identifier))}/view`,
  editRule: (identifier: PrometheusAlertingRuleIdentifier) =>
    `${baseUrl}/rules/${encodeURIComponent(ruleId.stringifyIdentifier(identifier))}/edit`,
  cloneRule: (identifier: PrometheusAlertingRuleIdentifier) =>
    `${baseUrl}/rules/new?copyFrom=${encodeURIComponent(ruleId.stringifyIdentifier(identifier))}`,
  viewGroup: (dataSourceUid: string, namespace: string, groupName: string) =>
    `${baseUrl}/groups/${encodeURIComponent(dataSourceUid)}/${encodeURIComponent(namespace)}/${encodeURIComponent(groupName)}`,
  editGroup: (dataSourceUid: string, namespace: string, groupName: string) =>
    `${baseUrl}/groups/${encodeURIComponent(dataSourceUid)}/${encodeURIComponent(namespace)}/${encodeURIComponent(groupName)}/edit`,
};
