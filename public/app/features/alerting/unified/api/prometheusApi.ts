import { useCallback } from 'react';

import { useDispatch } from 'app/types/store';
import { RuleHealth } from 'app/types/unified-alerting';
import {
  GrafanaPromRuleGroupDTO,
  PromAlertingRuleState,
  PromRuleDTO,
  PromRuleGroupDTO,
} from 'app/types/unified-alerting-dto';

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

type GrafanaPromRulesOptions = Omit<PromRulesOptions, 'ruleSource' | 'excludeAlerts'> & {
  folderUid?: string; // Folder UID for exact match filtering
  namespace?: string; // Folder name for substring matching
  dashboardUid?: string;
  panelId?: number;
  limitAlerts?: number;
  contactPoint?: string;
  health?: RuleHealth[];
  state?: PromAlertingRuleState[];
  type?: 'alerting' | 'recording';
  labels?: string[];
  hidePlugins?: boolean;
  datasourceUids?: string[];
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
      query: ({
        folderUid,
        namespace,
        groupName,
        ruleName,
        contactPoint,
        health,
        state,
        groupLimit,
        limitAlerts,
        groupNextToken,
        type,
        labels,
        hidePlugins,
        dashboardUid,
        panelId,
        datasourceUids,
      }) => ({
        url: `api/prometheus/grafana/api/v1/rules`,
        params: {
          folder_uid: folderUid, // Folder UID for exact match filtering
          namespace: namespace, // Folder name for substring matching
          rule_group: groupName,
          rule_name: ruleName,
          receiver_name: contactPoint,
          health: health,
          state: state,
          limit_alerts: limitAlerts,
          group_limit: groupLimit?.toFixed(0),
          group_next_token: groupNextToken,
          type: type,
          // Labels need to be sent as JSON matchers - convert to matcher format
          // Prometheus MatchType: MatchEqual=0, MatchNotEqual=1, MatchRegexp=2, MatchNotRegexp=3
          matcher: labels?.map((label) => {
            // Parse label matchers like "key=value", "key!=value", "key=~regex", "key!~regex"
            let name: string, value: string, type: number;

            if (label.includes('=~')) {
              [name, value] = label.split('=~');
              type = 2; // MatchRegexp
            } else if (label.includes('!~')) {
              [name, value] = label.split('!~');
              type = 3; // MatchNotRegexp
            } else if (label.includes('!=')) {
              [name, value] = label.split('!=');
              type = 1; // MatchNotEqual
            } else {
              [name, value] = label.split('=');
              type = 0; // MatchEqual
            }

            return JSON.stringify({
              Name: name?.trim() || '',
              Value: value?.trim() || '',
              Type: type,
            });
          }),
          hide_plugins: hidePlugins?.toString(),
          dashboard_uid: dashboardUid,
          panel_id: panelId,
          datasource_uid: datasourceUids,
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

  const populateGroupsResponseCache = useCallback(
    (groups: GrafanaPromRuleGroupDTO[]) => {
      dispatch(
        prometheusApi.util.upsertQueryEntries(
          groups.map((group) => ({
            endpointName: 'getGrafanaGroups',
            arg: { folderUid: group.folderUid, groupName: group.name, limitAlerts: 0 },
            value: { data: { groups: [group] }, status: 'success' },
          }))
        )
      );
    },
    [dispatch]
  );

  return { populateGroupsResponseCache };
}
