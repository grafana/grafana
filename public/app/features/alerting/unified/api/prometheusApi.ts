import type * as GrafanaFlavor from '@grafana/alerting/src/types/grafana/rules/api';
import type * as VanillaFlavor from '@grafana/alerting/src/types/prometheus/rules/api';

import { GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';

import { alertingApi } from './alertingApi';
import { normalizeRuleGroup } from './prometheus';

interface PromRulesOptions {
  ruleSource: { uid: string };
  namespace?: string;
  groupName?: string;
  ruleName?: string;
  groupLimit?: number;
  excludeAlerts?: boolean;
  groupNextToken?: string;
}

type GrafanaPromRulesOptions = Omit<PromRulesOptions, 'ruleSource'> & {
  dashboardUid?: string;
  panelId?: number;
};

export const prometheusApi = alertingApi.injectEndpoints({
  endpoints: (build) => ({
    getGroups: build.query<VanillaFlavor.PrometheusRuleGroupResponse, PromRulesOptions>({
      query: ({ ruleSource, namespace, groupName, ruleName, groupLimit, excludeAlerts, groupNextToken }) => {
        if (ruleSource.uid === GRAFANA_RULES_SOURCE_NAME) {
          throw new Error('Please use getGrafanaGroups endpoint for grafana rules');
        }
        return {
          url: `api/prometheus/${ruleSource.uid}/api/v1/rules`,
          params: {
            'file[]': namespace,
            'group[]': groupName,
            'rule[]': ruleName,
            exclude_alerts: excludeAlerts?.toString(),
            group_limit: groupLimit?.toFixed(0),
            group_next_token: groupNextToken,
          },
        };
      },
      transformResponse: (response: VanillaFlavor.PrometheusRuleGroupResponse) => {
        return { ...response, data: { ...response.data, groups: response.data.groups.map(normalizeRuleGroup) } };
      },
    }),
    getGrafanaGroups: build.query<GrafanaFlavor.PrometheusRuleGroupResponse, GrafanaPromRulesOptions>({
      query: ({ namespace, groupName, ruleName, groupLimit, excludeAlerts, groupNextToken }) => ({
        url: `api/prometheus/grafana/api/v1/rules`,
        params: {
          'file[]': namespace,
          'group[]': groupName,
          'rule[]': ruleName,
          exclude_alerts: excludeAlerts?.toString(),
          group_limit: groupLimit?.toFixed(0),
          group_next_token: groupNextToken,
        },
      }),
    }),
  }),
});
