import { RulerRuleGroupDTO, RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';
import { dataSourceRequest, DataSourceType, getLotexDataSourceByName } from '../utils/datasource';
import yaml from 'yaml';

function getRulerRulesEndpoint(datasourceName: string) {
  return getLotexDataSourceByName(datasourceName).type === DataSourceType.Loki ? '/api/prom/rules' : '/rules';
}

// upsert a rule group. use this to update rules
export async function setRulerRuleGroup(
  dataSourceName: string,
  namespace: string,
  group: RulerRuleGroupDTO
): Promise<void> {
  const endpoint = `${getRulerRulesEndpoint(dataSourceName)}/${encodeURIComponent(namespace)}`;

  await dataSourceRequest<RulerRulesConfigDTO>(dataSourceName, endpoint, {
    data: yaml.stringify(group),
    headers: {
      'Content-Type': 'application/yaml',
    },
    method: 'POST',
  });
}

// fetch all ruler rule namespaces and included groups
export async function fetchRulerRules(dataSourceName: string): Promise<RulerRulesConfigDTO> {
  const response = await dataSourceRequest<string>(dataSourceName, getRulerRulesEndpoint(dataSourceName));
  return yaml.parse(response.data);
}

// fetch rule groups for a particular namespace
// will throw with { status: 404 } if namespace does not exist
export async function fetchRulerRulesNamespace(
  dataSourceName: string,
  namespace: string
): Promise<RulerRuleGroupDTO[]> {
  const response = await dataSourceRequest<string>(
    dataSourceName,
    `${getRulerRulesEndpoint(dataSourceName)}/${encodeURIComponent(namespace)}`
  );
  return yaml.parse(response.data)[namespace];
}

// fetch a particular rule group
// will throw with { status: 404 } if rule group does not exist
export async function fetchRulerRulesGroup(
  dataSourceName: string,
  namespace: string,
  group: string
): Promise<RulerRuleGroupDTO> {
  const response = await dataSourceRequest<string>(
    dataSourceName,
    `${getRulerRulesEndpoint(dataSourceName)}/${encodeURIComponent(namespace)}/${encodeURIComponent(group)}`
  );
  return yaml.parse(response.data);
}
