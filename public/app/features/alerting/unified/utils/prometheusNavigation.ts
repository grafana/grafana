import { type CloudRuleIdentifier, type PrometheusRuleIdentifier } from 'app/types/unified-alerting';

import { PROMETHEUS_ALERTING_APP_ID } from '../hooks/useDMAStatus';

import { getDatasourceAPIUid } from './datasource';
import * as ruleId from './rule-id';

const baseUrl = `/a/${PROMETHEUS_ALERTING_APP_ID}`;

type PrometheusAlertingRuleIdentifier = CloudRuleIdentifier | PrometheusRuleIdentifier;

interface NewRuleOptions {
  defaults?: string;
  returnTo?: string;
}

export const prometheusAlertingPlugin = {
  install: `/plugins/${PROMETHEUS_ALERTING_APP_ID}`,
  rules: `${baseUrl}/rules`,
  newRule: (type: 'alerting' | 'recording', options: NewRuleOptions = {}) => {
    const searchParams = new URLSearchParams({ type });

    if (options.defaults) {
      searchParams.set('defaults', options.defaults);
    }
    if (options.returnTo) {
      searchParams.set('returnTo', options.returnTo);
    }

    return `${baseUrl}/rules/new?${searchParams.toString()}`;
  },
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
