import { PromRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { alertingApi } from './alertingApi';

interface PromRulesResponse {
  status: string;
  data: {
    groups: PromRuleGroupDTO[];
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

export const prometheusApi = alertingApi.injectEndpoints({
  endpoints: (build) => ({
    groups: build.query<PromRulesResponse, PromRulesOptions>({
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
  }),
});
