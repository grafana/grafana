import { RelativeTimeRange } from '@grafana/data';
import { Matcher } from 'app/plugins/datasource/alertmanager/types';
import { RuleIdentifier, RuleNamespace } from 'app/types/unified-alerting';
import {
  AlertQuery,
  Annotations,
  GrafanaAlertStateDecision,
  Labels,
  PromRulesResponse,
} from 'app/types/unified-alerting-dto';

import { Folder } from '../components/rule-editor/RuleFolderPicker';
import { GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';
import { arrayKeyValuesToObject } from '../utils/labels';
import { isCloudRuleIdentifier, isPrometheusRuleIdentifier } from '../utils/rules';

import { alertingApi } from './alertingApi';
import {
  FetchPromRulesFilter,
  groupRulesByFileName,
  paramsWithMatcherAndState,
  prepareRulesFilterQueryParams,
} from './prometheus';

export type ResponseLabels = {
  labels: AlertInstances[];
};

export type PreviewResponse = ResponseLabels[];
export interface Datasource {
  type: string;
  uid: string;
}

export const PREVIEW_URL = '/api/v1/rule/test/grafana';
export const PROM_RULES_URL = 'api/prometheus/grafana/api/v1/rules';

export interface Data {
  refId: string;
  relativeTimeRange: RelativeTimeRange;
  queryType: string;
  datasourceUid: string;
  model: AlertQuery;
}
export interface GrafanaAlert {
  data?: Data;
  condition: string;
  no_data_state: GrafanaAlertStateDecision;
  title: string;
}

export interface Rule {
  grafana_alert: GrafanaAlert;
  for: string;
  labels: Labels;
  annotations: Annotations;
}
export type AlertInstances = Record<string, string>;

export const alertRuleApi = alertingApi.injectEndpoints({
  endpoints: (build) => ({
    preview: build.mutation<
      PreviewResponse,
      {
        alertQueries: AlertQuery[];
        condition: string;
        folder: Folder;
        customLabels: Array<{
          key: string;
          value: string;
        }>;
        alertName?: string;
        alertUid?: string;
      }
    >({
      query: ({ alertQueries, condition, customLabels, folder, alertName, alertUid }) => ({
        url: PREVIEW_URL,
        data: {
          rule: {
            grafana_alert: {
              data: alertQueries,
              condition: condition,
              no_data_state: 'Alerting',
              title: alertName,
              uid: alertUid ?? 'N/A',
            },
            for: '0s',
            labels: arrayKeyValuesToObject(customLabels),
            annotations: {},
          },
          folderUid: folder.uid,
          folderTitle: folder.title,
        },
        method: 'POST',
      }),
    }),

    prometheusRulesByNamespace: build.query<
      RuleNamespace[],
      {
        limitAlerts?: number;
        identifier?: RuleIdentifier;
        filter?: FetchPromRulesFilter;
        state?: string[];
        matcher?: Matcher[];
      }
    >({
      query: ({ limitAlerts, identifier, filter, state, matcher }) => {
        const searchParams = new URLSearchParams();

        // if we're fetching for Grafana managed rules, we should add a limit to the number of alert instances
        // we do this because the response is large otherwise and we don't show all of them in the UI anyway.
        if (limitAlerts) {
          searchParams.set('limit_alerts', String(limitAlerts));
        }

        if (identifier && (isPrometheusRuleIdentifier(identifier) || isCloudRuleIdentifier(identifier))) {
          searchParams.set('file', identifier.namespace);
          searchParams.set('rule_group', identifier.groupName);
        }

        const params = prepareRulesFilterQueryParams(searchParams, filter);

        return { url: PROM_RULES_URL, params: paramsWithMatcherAndState(params, state, matcher) };
      },
      transformResponse: (response: PromRulesResponse): RuleNamespace[] => {
        return groupRulesByFileName(response.data.groups, GRAFANA_RULES_SOURCE_NAME);
      },
    }),
  }),
});
