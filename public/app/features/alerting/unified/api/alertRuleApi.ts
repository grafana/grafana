import { Matcher } from 'app/plugins/datasource/alertmanager/types';
import { RuleIdentifier, RuleNamespace } from 'app/types/unified-alerting';
import { PromRulesResponse } from 'app/types/unified-alerting-dto';

import { GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';
import { isCloudRuleIdentifier, isPrometheusRuleIdentifier } from '../utils/rules';

import { alertingApi } from './alertingApi';
import {
  FetchPromRulesFilter,
  groupRulesByFileName,
  paramsWithMatcherAndState,
  prepareRulesFilterQueryParams,
} from './prometheus';
export interface Datasource {
  type: string;
  uid: string;
}

export const PREVIEW_URL = '/api/v1/rule/test/grafana';
export const PROM_RULES_URL = 'api/prometheus/grafana/api/v1/rules';

export const alertRuleApi = alertingApi.injectEndpoints({
  endpoints: (build) => ({
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
