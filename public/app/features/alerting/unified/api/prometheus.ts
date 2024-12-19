import { produce } from 'immer';
import { lastValueFrom } from 'rxjs';

import { getBackendSrv } from '@grafana/runtime';
import { logInfo } from 'app/features/alerting/unified/Analytics';
import { Matcher } from 'app/plugins/datasource/alertmanager/types';
import { RuleGroup, RuleIdentifier, RuleNamespace } from 'app/types/unified-alerting';
import {
  PromAlertingRuleState,
  PromRuleGroupDTO,
  PromRuleType,
  PromRulesResponse,
} from 'app/types/unified-alerting-dto';

import { GRAFANA_RULES_SOURCE_NAME, getDatasourceAPIUid } from '../utils/datasource';
import { isCloudRuleIdentifier, isPrometheusRuleIdentifier } from '../utils/rules';

export interface FetchPromRulesFilter {
  dashboardUID?: string;
  panelId?: number;
}

export interface PrometheusDataSourceConfig {
  dataSourceName: string;
  limitAlerts?: number;
  identifier?: RuleIdentifier;
}

export function prometheusUrlBuilder(dataSourceConfig: PrometheusDataSourceConfig) {
  const { dataSourceName, limitAlerts, identifier } = dataSourceConfig;

  return {
    rules: (filter?: FetchPromRulesFilter, state?: string[], matcher?: Matcher[]) => {
      const searchParams = new URLSearchParams();

      // if we're fetching for Grafana managed rules, we should add a limit to the number of alert instances
      // we do this because the response is large otherwise and we don't show all of them in the UI anyway.
      if (dataSourceName === GRAFANA_RULES_SOURCE_NAME && limitAlerts) {
        searchParams.set('limit_alerts', String(limitAlerts));
      }

      if (identifier && (isPrometheusRuleIdentifier(identifier) || isCloudRuleIdentifier(identifier))) {
        searchParams.set('file', identifier.namespace);
        searchParams.set('rule_group', identifier.groupName);
      }

      const filterParams = getRulesFilterSearchParams(filter);

      const params = { ...filterParams, ...Object.fromEntries(searchParams) };
      return {
        url: `/api/prometheus/${getDatasourceAPIUid(dataSourceName)}/api/v1/rules`,
        params: paramsWithMatcherAndState(params, state, matcher),
      };
    },
  };
}

export function getRulesFilterSearchParams(filter?: FetchPromRulesFilter): Record<string, string> {
  const filterParams: Record<string, string> = {};

  if (filter?.dashboardUID) {
    filterParams.dashboard_uid = filter.dashboardUID;
    if (filter?.panelId) {
      filterParams.panel_id = String(filter.panelId);
    }
  }

  return filterParams;
}

export function paramsWithMatcherAndState(
  params: Record<string, string | string[]>,
  state?: string[],
  matchers?: Matcher[]
) {
  let paramsResult = { ...params };

  if (state?.length) {
    paramsResult = { ...paramsResult, state };
  }

  if (matchers?.length) {
    const matcherToJsonString: string[] = matchers.map((m) => JSON.stringify(m));
    paramsResult = {
      ...paramsResult,
      matcher: matcherToJsonString,
    };
  }

  return paramsResult;
}

export function normalizeRuleGroup(group: PromRuleGroupDTO): PromRuleGroupDTO {
  return produce(group, (draft) => {
    draft.rules.forEach((rule) => {
      rule.query = rule.query || '';
      if (rule.type === PromRuleType.Alerting) {
        // There's a possibility that a custom/unexpected datasource might response with
        // `type: alerting` but no state
        // In this case, we fall back to `Inactive` state so that elsewhere in the UI we don't fail/have to handle the edge case
        // and log a message so we can identify how frequently this might be happening
        if (!rule.state) {
          logInfo('prom rule with type=alerting is missing a state', { ruleName: rule.name });
          rule.state = PromAlertingRuleState.Inactive;
        }
      }
    });
  });
}

export const groupRulesByFileName = (groups: PromRuleGroupDTO[], dataSourceName: string) => {
  const normalizedGroups = groups.map(normalizeRuleGroup);

  const nsMap: { [key: string]: RuleNamespace } = {};
  normalizedGroups.forEach((group) => {
    if (!nsMap[group.file]) {
      nsMap[group.file] = {
        dataSourceName,
        name: group.file,
        groups: [group],
      };
    } else {
      nsMap[group.file].groups.push(group);
    }
  });

  return Object.values(nsMap);
};

export const ungroupRulesByFileName = (namespaces: RuleNamespace[] = []): PromRuleGroupDTO[] => {
  return namespaces?.flatMap((namespace) =>
    namespace.groups.flatMap((group) => ruleGroupToPromRuleGroupDTO(group, namespace.name))
  );
};

function ruleGroupToPromRuleGroupDTO(group: RuleGroup, namespace: string): PromRuleGroupDTO {
  return {
    name: group.name,
    file: namespace,
    rules: group.rules,
    interval: group.interval,
  };
}
export async function fetchRules(
  dataSourceName: string,
  filter?: FetchPromRulesFilter,
  limitAlerts?: number,
  matcher?: Matcher[],
  state?: string[],
  identifier?: RuleIdentifier
): Promise<RuleNamespace[]> {
  if (filter?.dashboardUID && dataSourceName !== GRAFANA_RULES_SOURCE_NAME) {
    throw new Error('Filtering by dashboard UID is only supported for Grafana Managed rules.');
  }

  const { url, params } = prometheusUrlBuilder({ dataSourceName, limitAlerts, identifier }).rules(
    filter,
    state,
    matcher
  );

  // adding state param here instead of adding it in prometheusUrlBuilder, for being a possible multiple query param
  const response = await lastValueFrom(
    getBackendSrv().fetch<PromRulesResponse>({
      url,
      params: params,
      showErrorAlert: false,
      showSuccessAlert: false,
    })
  ).catch((e) => {
    if ('status' in e && e.status === 404) {
      throw new Error('404 from rule state endpoint. Perhaps ruler API is not enabled?');
    }
    throw e;
  });

  return groupRulesByFileName(response.data.data.groups, dataSourceName);
}
