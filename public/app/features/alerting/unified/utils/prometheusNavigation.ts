import { type CloudRuleIdentifier, type PrometheusRuleIdentifier } from 'app/types/unified-alerting';

import { PROMETHEUS_ALERTING_APP_ID } from '../hooks/useDMAStatus';

import { getDatasourceAPIUid } from './datasource';
import * as ruleId from './rule-id';

const baseUrl = `/a/${PROMETHEUS_ALERTING_APP_ID}`;

type PrometheusAlertingRuleIdentifier = CloudRuleIdentifier | PrometheusRuleIdentifier;

export const prometheusAlertingPlugin = {
  install: `/plugins/${PROMETHEUS_ALERTING_APP_ID}`,
  rules: `${baseUrl}/rules`,
  newRule: (type: 'alerting' | 'recording') => `${baseUrl}/rules/new?type=${type}`,
  viewRule: (identifier: PrometheusAlertingRuleIdentifier) =>
    `${baseUrl}/rules/${stringifyPluginRuleIdentifier(identifier)}`,
  editRule: (identifier: PrometheusAlertingRuleIdentifier) =>
    `${baseUrl}/rules/${stringifyPluginRuleIdentifier(identifier)}/edit`,
  cloneRule: (identifier: PrometheusAlertingRuleIdentifier) =>
    `${baseUrl}/rules/new?copyFrom=${stringifyPluginRuleIdentifier(identifier)}`,
  viewGroup: (dataSourceUid: string, namespace: string, groupName: string) =>
    `${baseUrl}/groups/${encodeURIComponent(dataSourceUid)}/${encodeURIComponent(namespace)}/${encodeURIComponent(groupName)}`,
  editGroup: (dataSourceUid: string, namespace: string, groupName: string) =>
    `${baseUrl}/groups/${encodeURIComponent(dataSourceUid)}/${encodeURIComponent(namespace)}/${encodeURIComponent(groupName)}/edit`,
};

function stringifyPluginRuleIdentifier(identifier: PrometheusAlertingRuleIdentifier): string {
  const pluginIdentifier = { ...identifier, ruleSourceName: getDatasourceAPIUid(identifier.ruleSourceName) };

  return encodeURIComponent(ruleId.stringifyIdentifier(pluginIdentifier));
}
