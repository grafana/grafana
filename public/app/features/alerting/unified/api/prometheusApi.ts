import { GrafanaPromRuleGroupDTO, PromRuleDTO, PromRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { alertingApi } from './alertingApi';

export interface PromRulesResponse<TRuleGroup> {
  status: string;
  data: {
    groups: TRuleGroup[];
    groupNextToken?: string;
  };
  errorType?: string;
  error?: string;
}

interface PromRulesOptions {
  ruleSource: { uid: string };
  namespace?: string;
  groupName?: string;
  ruleName?: string;
  groupLimit?: number;
  excludeAlerts?: boolean;
  groupNextToken?: string;
}

type GrafanaPromRulesOptions = Omit<PromRulesOptions, 'ruleSource'>;

export const prometheusApi = alertingApi.injectEndpoints({
  endpoints: (build) => ({
    getGroups: build.query<PromRulesResponse<PromRuleGroupDTO<PromRuleDTO>>, PromRulesOptions>({
      query: ({ ruleSource, namespace, groupName, ruleName, groupLimit, excludeAlerts, groupNextToken }) => ({
        url: `api/prometheus/${ruleSource.uid}/api/v1/rules`,
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
    getGrafanaGroups: build.query<PromRulesResponse<GrafanaPromRuleGroupDTO>, GrafanaPromRulesOptions>({
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
