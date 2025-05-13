import { useCallback } from 'react';

import { useDispatch } from 'app/types';
import { GrafanaPromRuleGroupDTO, PromRuleDTO, PromRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';

import { WithNotificationOptions, alertingApi } from './alertingApi';
import { normalizeRuleGroup } from './prometheus';

export interface PromRulesResponse<TRuleGroup> {
  status: string;
  data: {
    groups: TRuleGroup[];
    groupNextToken?: string;
  };
  errorType?: string;
  error?: string;
}

type PromRulesOptions = WithNotificationOptions<{
  ruleSource: { uid: string };
  namespace?: string;
  groupName?: string;
  ruleName?: string;
  groupLimit?: number;
  excludeAlerts?: boolean;
  groupNextToken?: string;
}>;

type GrafanaPromRulesOptions = Omit<PromRulesOptions, 'ruleSource' | 'namespace'> & {
  folderUid?: string;
  dashboardUid?: string;
  panelId?: number;
};

export const prometheusApi = alertingApi.injectEndpoints({
  endpoints: (build) => ({
    getGroups: build.query<PromRulesResponse<PromRuleGroupDTO<PromRuleDTO>>, PromRulesOptions>({
      query: ({
        ruleSource,
        namespace,
        groupName,
        ruleName,
        groupLimit,
        excludeAlerts,
        groupNextToken,
        notificationOptions,
      }) => {
        if (ruleSource.uid === GRAFANA_RULES_SOURCE_NAME) {
          throw new Error('Please use getGrafanaGroups endpoint for grafana rules');
        }
        return {
          url: `api/prometheus/${ruleSource.uid}/api/v1/rules`,
          params: {
            file: namespace, // Mimir
            'file[]': namespace, // Prometheus
            rule_group: groupName, // Mimir
            'rule_group[]': groupName, // Prometheus
            rule_name: ruleName, // Mimir
            'rule_name[]': ruleName, // Prometheus
            exclude_alerts: excludeAlerts?.toString(),
            group_limit: groupLimit?.toFixed(0),
            group_next_token: groupNextToken,
          },
          notificationOptions,
        };
      },
      transformResponse: (response: PromRulesResponse<PromRuleGroupDTO<PromRuleDTO>>) => {
        return { ...response, data: { ...response.data, groups: response.data.groups.map(normalizeRuleGroup) } };
      },
    }),
    getGrafanaGroups: build.query<PromRulesResponse<GrafanaPromRuleGroupDTO>, GrafanaPromRulesOptions>({
      query: ({ folderUid, groupName, ruleName, groupLimit, excludeAlerts, groupNextToken }) => ({
        url: `api/prometheus/grafana/api/v1/rules`,
        params: {
          folder_uid: folderUid,
          rule_group: groupName,
          rule_name: ruleName,
          exclude_alerts: excludeAlerts?.toString(),
          group_limit: groupLimit?.toFixed(0),
          group_next_token: groupNextToken,
        },
      }),
      providesTags: (_result, _error, { folderUid, groupName, ruleName }) => {
        const folderKey = folderUid ?? '__any__';
        const groupKey = groupName ?? '__any__';
        const ruleKey = ruleName ?? '__any__';
        return [{ type: 'GrafanaPrometheusGroups', id: `grafana/${folderKey}/${groupKey}/${ruleKey}` }];
      },
    }),
  }),
});

export function usePopulateGrafanaPrometheusApiCache() {
  const dispatch = useDispatch();

  const populateGroupResponseCache = useCallback(
    (group: GrafanaPromRuleGroupDTO) => {
      dispatch(
        prometheusApi.util.upsertQueryData(
          'getGrafanaGroups',
          { folderUid: group.folderUid, groupName: group.name },
          { data: { groups: [group] }, status: 'success' }
        )
      );
    },
    [dispatch]
  );

  return { populateGroupResponseCache };
}
