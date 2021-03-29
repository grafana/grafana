import { RulerRuleGroupDTO, RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';
import { getDatasourceAPIId } from '../utils/datasource';
import { getBackendSrv } from '@grafana/runtime';

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
export async function fetchRulerRules(dataSourceName: string): Promise<RulerRulesConfigDTO> {
  return getBackendSrv().get(`/ruler/${getDatasourceAPIId(dataSourceName)}/api/v1/rules`);
}

// fetch rule groups for a particular namespace
// will throw with { status: 404 } if namespace does not exist
export async function fetchRulerRulesNamespace(
  dataSourceName: string,
  namespace: string
): Promise<RulerRuleGroupDTO[]> {
  return getBackendSrv()
    .get(`/ruler/${getDatasourceAPIId(dataSourceName)}/api/v1/rules/${encodeURIComponent(namespace)}`)
    .then((result) => result[namespace]);
}

// fetch a particular rule group
// will throw with { status: 404 } if rule group does not exist
export async function fetchRulerRulesGroup(
  dataSourceName: string,
  namespace: string,
  group: string
): Promise<RulerRuleGroupDTO> {
  return getBackendSrv().get(
    `/ruler/${getDatasourceAPIId(dataSourceName)}/api/v1/rules/${encodeURIComponent(namespace)}/${encodeURIComponent(
      group
    )}`
  );
}
