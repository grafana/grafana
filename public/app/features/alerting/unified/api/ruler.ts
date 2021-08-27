import { lastValueFrom } from 'rxjs';
import { getBackendSrv } from '@grafana/runtime';

import { PostableRulerRuleGroupDTO, RulerRuleGroupDTO, RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';
import { getDatasourceAPIId } from '../utils/datasource';
import { RULER_NOT_SUPPORTED_MSG } from '../utils/constants';

// upsert a rule group. use this to update rules
export async function setRulerRuleGroup(
  dataSourceName: string,
  namespace: string,
  group: PostableRulerRuleGroupDTO
): Promise<void> {
  await lastValueFrom(
    getBackendSrv().fetch<unknown>({
      method: 'POST',
      url: `/api/ruler/${getDatasourceAPIId(dataSourceName)}/api/v1/rules/${encodeURIComponent(namespace)}`,
      data: group,
      showErrorAlert: false,
      showSuccessAlert: false,
    })
  );
}

// fetch all ruler rule namespaces and included groups
export async function fetchRulerRules(dataSourceName: string) {
  return rulerGetRequest<RulerRulesConfigDTO>(`/api/ruler/${getDatasourceAPIId(dataSourceName)}/api/v1/rules`, {});
}

// fetch rule groups for a particular namespace
// will throw with { status: 404 } if namespace does not exist
export async function fetchRulerRulesNamespace(dataSourceName: string, namespace: string) {
  const result = await rulerGetRequest<Record<string, RulerRuleGroupDTO[]>>(
    `/api/ruler/${getDatasourceAPIId(dataSourceName)}/api/v1/rules/${encodeURIComponent(namespace)}`,
    {}
  );
  return result[namespace] || [];
}

// fetch a particular rule group
// will throw with { status: 404 } if rule group does not exist
export async function fetchRulerRulesGroup(
  dataSourceName: string,
  namespace: string,
  group: string
): Promise<RulerRuleGroupDTO | null> {
  return rulerGetRequest<RulerRuleGroupDTO | null>(
    `/api/ruler/${getDatasourceAPIId(dataSourceName)}/api/v1/rules/${encodeURIComponent(
      namespace
    )}/${encodeURIComponent(group)}`,
    null
  );
}

export async function deleteRulerRulesGroup(dataSourceName: string, namespace: string, groupName: string) {
  await lastValueFrom(
    getBackendSrv().fetch({
      url: `/api/ruler/${getDatasourceAPIId(dataSourceName)}/api/v1/rules/${encodeURIComponent(
        namespace
      )}/${encodeURIComponent(groupName)}`,
      method: 'DELETE',
      showSuccessAlert: false,
      showErrorAlert: false,
    })
  );
}

// false in case ruler is not supported. this is weird, but we'll work on it
async function rulerGetRequest<T>(url: string, empty: T): Promise<T> {
  try {
    const response = await lastValueFrom(
      getBackendSrv().fetch<T>({
        url,
        showErrorAlert: false,
        showSuccessAlert: false,
      })
    );
    return response.data;
  } catch (e) {
    if (e?.status === 404) {
      if (e?.data?.message?.includes('group does not exist') || e?.data?.message?.includes('no rule groups found')) {
        return empty;
      }
      throw new Error('404 from rules config endpoint. Perhaps ruler API is not enabled?');
    } else if (
      e?.status === 500 &&
      e?.data?.message?.includes('unexpected content type from upstream. expected YAML, got text/html')
    ) {
      throw {
        ...e,
        data: {
          ...e?.data,
          message: RULER_NOT_SUPPORTED_MSG,
        },
      };
    }
    throw e;
  }
}

export async function deleteNamespace(dataSourceName: string, namespace: string): Promise<void> {
  await lastValueFrom(
    getBackendSrv().fetch<unknown>({
      method: 'DELETE',
      url: `/api/ruler/${getDatasourceAPIId(dataSourceName)}/api/v1/rules/${encodeURIComponent(namespace)}`,
      showErrorAlert: false,
      showSuccessAlert: false,
    })
  );
}
