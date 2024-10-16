import { PromRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { alertingApi } from './alertingApi';

interface PromRulesResponse {
  status: string;
  data: {
    groups: PromRuleGroupDTO[];
    nextToken?: string;
  };
  errorType?: string;
  error?: string;
}

interface PromRulesOptions {
  ruleSource: { uid: string };
  namespace?: string;
  groupName?: string;
  ruleName?: string;
  maxGroups?: number;
  excludeAlerts?: boolean;
  nextToken?: string;
}

export const prometheusApi = alertingApi.injectEndpoints({
  endpoints: (build) => ({
    groups: build.query<PromRulesResponse, PromRulesOptions>({
      query: ({ ruleSource, namespace, groupName, ruleName, maxGroups, excludeAlerts, nextToken }) => ({
        url: `api/prometheus/${ruleSource.uid}/api/v1/rules`,
        params: {
          'file[]': namespace,
          'group[]': groupName,
          'rule[]': ruleName,
          max_groups: maxGroups?.toFixed(0),
          exclude_alerts: excludeAlerts?.toString(),
          next_token: nextToken,
        },
      }),
    }),
  }),
});
