import { lastValueFrom } from 'rxjs';
import { getBackendSrv } from '@grafana/runtime';

import { RuleNamespace } from 'app/types/unified-alerting';
import {
  PromApplication,
  PromBuildInfo,
  PromBuildInfoResponse,
  PromRulesResponse,
} from 'app/types/unified-alerting-dto';
import { getDatasourceAPIId, GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';

export interface FetchPromRulesFilter {
  dashboardUID: string;
  panelId?: number;
}

export async function fetchRules(dataSourceName: string, filter?: FetchPromRulesFilter): Promise<RuleNamespace[]> {
  if (filter?.dashboardUID && dataSourceName !== GRAFANA_RULES_SOURCE_NAME) {
    throw new Error('Filtering by dashboard UID is not supported for cloud rules sources.');
  }

  const params: Record<string, string> = {};
  if (filter?.dashboardUID) {
    params['dashboard_uid'] = filter.dashboardUID;
    if (filter.panelId) {
      params['panel_id'] = String(filter.panelId);
    }
  }

  const response = await lastValueFrom(
    getBackendSrv().fetch<PromRulesResponse>({
      url: `/api/prometheus/${getDatasourceAPIId(dataSourceName)}/api/v1/rules`,
      showErrorAlert: false,
      showSuccessAlert: false,
      params,
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

export async function fetchBuildInfo(dataSourceName: string): Promise<PromBuildInfo> {
  const response = await lastValueFrom(
    getBackendSrv().fetch<PromBuildInfoResponse>({
      url: `/api/datasources/proxy/${getDatasourceAPIId(dataSourceName)}/api/v1/status/buildinfo`,
      showErrorAlert: false,
      showSuccessAlert: false,
    })
  ).catch((e) => {
    if ('status' in e && e.status === 404) {
      return null; // Cortex does not support buildinfo endpoint
    }

    throw e;
  });

  if (!response || !response) {
    // TODO As a fallback add checking whether ruler is available
    return {
      application: PromApplication.Cortex,
      features: {
        rulerConfigApp: true,
        alertManagerConfigApi: false,
        querySharding: false,
        federatedRules: false,
      },
    };
  }

  const { application, features } = response.data;

  return {
    application: PromApplication.Prometheus,
    features: {
      rulerConfigApp: features?.ruler_config_app === 'true',
      alertManagerConfigApi: features?.alertmanager_config_api === 'true',
      querySharding: features?.query_sharding === 'true',
      federatedRules: features?.federated_rules === 'true',
    },
  };
}
