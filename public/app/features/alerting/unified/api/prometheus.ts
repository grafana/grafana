import { lastValueFrom } from 'rxjs';

import { getBackendSrv } from '@grafana/runtime';
import { RuleNamespace } from 'app/types/unified-alerting';
import { GrafanaAlertState, PromRulesResponse } from 'app/types/unified-alerting-dto';

import { getDatasourceAPIUid, GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';

export interface FetchPromRulesFilter {
  dashboardUID: string;
  panelId?: number;
}

export interface PrometheusDataSourceConfig {
  dataSourceName: string;
  limitAlerts?: number;
  matchers?: string;
  state?: GrafanaAlertState[];
}

export function prometheusUrlBuilder(dataSourceConfig: PrometheusDataSourceConfig) {
  const { dataSourceName, limitAlerts, matchers, state } = dataSourceConfig;

  return {
    rules: (filter?: FetchPromRulesFilter) => {
      const searchParams = new URLSearchParams();

      // if we're fetching for Grafana managed rules, we should add a limit to the number of alert instances
      // we do this because the response is large otherwise and we don't show all of them in the UI anyway.
      if (dataSourceName === GRAFANA_RULES_SOURCE_NAME && limitAlerts) {
        searchParams.set('limit_alerts', String(limitAlerts));
      }
      if (dataSourceName === GRAFANA_RULES_SOURCE_NAME && matchers) {
        searchParams.set('matchers', matchers);
      }

      if (dataSourceName === GRAFANA_RULES_SOURCE_NAME && state) {
        state.forEach((item: GrafanaAlertState) => {
          searchParams.append('state', item);
        });
      }

      //@TODO: multiple states are not working as parameters don't maintain multiple keys after this call
      const params = prepareRulesFilterQueryParams(searchParams, filter);

      return {
        url: `/api/prometheus/${getDatasourceAPIUid(dataSourceName)}/api/v1/rules`,
        params: params,
      };
    },
  };
}

export function prepareRulesFilterQueryParams(
  params: URLSearchParams,
  filter?: FetchPromRulesFilter
): Record<string, string> {
  if (filter?.dashboardUID) {
    params.set('dashboard_uid', filter.dashboardUID);
    if (filter?.panelId) {
      params.set('panel_id', String(filter.panelId));
    }
  }

  return Object.fromEntries(params);
}

export async function fetchRules(
  dataSourceName: string,
  filter?: FetchPromRulesFilter,
  limitAlerts?: number,
  matchers?: string,
  state?: GrafanaAlertState[]
): Promise<RuleNamespace[]> {
  if (filter?.dashboardUID && dataSourceName !== GRAFANA_RULES_SOURCE_NAME) {
    throw new Error('Filtering by dashboard UID is only supported for Grafana Managed rules.');
  }

  const { url, params } = prometheusUrlBuilder({ dataSourceName, limitAlerts, matchers, state }).rules(filter);

  const response = await lastValueFrom(
    getBackendSrv().fetch<PromRulesResponse>({
      url,
      params,
      showErrorAlert: false,
      showSuccessAlert: false,
    })
  ).catch((e) => {
    if ('status' in e && e.status === 404) {
      throw new Error('404 from rule state endpoint. Perhaps ruler API is not enabled?');
    }
    throw e;
  });

  const nsMap: { [key: string]: RuleNamespace } = {};
  response.data.data.groups.forEach((group) => {
    group.rules.forEach((rule) => {
      rule.query = rule.query || '';
    });
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
}
