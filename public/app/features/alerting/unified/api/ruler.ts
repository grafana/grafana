import { RulerRuleGroupDTO, RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';
import { datasourceRequest, DataSourceType, getLotexDatasourceByName } from '../utils/datasource';
import yaml from 'yaml';

function getRulerRulesEndpoint(datasourceName: string) {
  return getLotexDatasourceByName(datasourceName).type === DataSourceType.Loki ? '/api/prom/rules' : '/rules';
}

// upsert a rule group. use this to update rules
export async function setRulerRuleGroup(
  datasourceName: string,
  namespace: string,
  group: RulerRuleGroupDTO
): Promise<void> {
  const endpoint = `${getRulerRulesEndpoint(datasourceName)}/${encodeURIComponent(namespace)}`;

  await datasourceRequest<RulerRulesConfigDTO>(datasourceName, endpoint, {
    data: yaml.stringify(group),
    headers: {
      'Content-Type': 'application/yaml',
    },
    method: 'POST',
  });
}

// fetch all ruler rule namespaces and included groups
export async function fetchRulerRules(datasourceName: string): Promise<RulerRulesConfigDTO> {
  const response = await datasourceRequest<string>(datasourceName, getRulerRulesEndpoint(datasourceName));
  return yaml.parse(response.data);
}

// fetch rule groups for a particular namespace
// will throw with { status: 404 } if namespace does not exist
export async function fetchRulerRulesNamespace(
  datasourceName: string,
  namespace: string
): Promise<RulerRuleGroupDTO[]> {
  const response = await datasourceRequest<string>(
    datasourceName,
    `${getRulerRulesEndpoint(datasourceName)}/${encodeURIComponent(namespace)}`
  );
  return yaml.parse(response.data)[namespace];
}

// fetch a particular rule group
// will throw with { status: 404 } if rule group does not exist
export async function fetchRulerRulesGroup(
  datasourceName: string,
  namespace: string,
  group: string
): Promise<RulerRuleGroupDTO> {
  const response = await datasourceRequest<string>(
    datasourceName,
    `${getRulerRulesEndpoint(datasourceName)}/${encodeURIComponent(namespace)}/${encodeURIComponent(group)}`
  );
  return yaml.parse(response.data);
}
