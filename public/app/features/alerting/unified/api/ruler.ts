import { RulerRuleGroupDTO, RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';
import { getDatasourceAPIId } from '../utils/datasource';
import { getBackendSrv } from '@grafana/runtime';
import { RULER_NOT_SUPPORTED_MSG } from '../utils/constants';

// upsert a rule group. use this to update rules
export async function setRulerRuleGroup(
  dataSourceName: string,
  namespace: string,
  group: RulerRuleGroupDTO
): Promise<void> {
  await getBackendSrv().post(
    `/ruler/${getDatasourceAPIId(dataSourceName)}/api/v1/rules/${encodeURIComponent(namespace)}`,
    group
  );
}

// fetch all ruler rule namespaces and included groups
export async function fetchRulerRules(dataSourceName: string) {
  return rulerGetRequest<RulerRulesConfigDTO>(`/ruler/${getDatasourceAPIId(dataSourceName)}/api/v1/rules`, {});
}

// fetch rule groups for a particular namespace
// will throw with { status: 404 } if namespace does not exist
export async function fetchRulerRulesNamespace(dataSourceName: string, namespace: string) {
  const result = await rulerGetRequest<Record<string, RulerRuleGroupDTO[]>>(
    `/ruler/${getDatasourceAPIId(dataSourceName)}/api/v1/rules/${encodeURIComponent(namespace)}`,
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
    `/ruler/${getDatasourceAPIId(dataSourceName)}/api/v1/rules/${encodeURIComponent(namespace)}/${encodeURIComponent(
      group
    )}`,
    null
  );
}

// false in case ruler is not supported. this is weird, but we'll work on it
async function rulerGetRequest<T>(url: string, empty: T): Promise<T> {
  try {
    const response = await getBackendSrv()
      .fetch<T>({
        url,
        showErrorAlert: false,
        showSuccessAlert: false,
      })
      .toPromise();
    return response.data;
  } catch (e) {
    if (e?.status === 404) {
      return empty;
    } else if (e?.status === 500 && e?.message?.includes('mapping values are not allowed in this context')) {
      throw {
        ...e,
        message: RULER_NOT_SUPPORTED_MSG,
      };
    }
    throw e;
  }
}
