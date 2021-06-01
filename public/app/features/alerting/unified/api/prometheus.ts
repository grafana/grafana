import { getBackendSrv } from '@grafana/runtime';
import { RuleNamespace } from 'app/types/unified-alerting';
import { PromRulesResponse } from 'app/types/unified-alerting-dto';
import { getAllRulesSourceNames, getDatasourceAPIId } from '../utils/datasource';

export async function fetchRules(dataSourceName: string): Promise<RuleNamespace[]> {
  const response = await getBackendSrv()
    .fetch<PromRulesResponse>({
      url: `/api/prometheus/${getDatasourceAPIId(dataSourceName)}/api/v1/rules`,
      showErrorAlert: false,
      showSuccessAlert: false,
    })
    .toPromise();

  const nsMap: { [key: string]: RuleNamespace } = {};
  response.data.data.groups.forEach((group) => {
    group.rules.forEach((rule) => {
      rule.query = rule.query || ''; // @TODO temp fix, backend response ism issing query. remove once it's there
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

export async function fetchAllRules(): Promise<RuleNamespace[]> {
  const namespaces = [] as Array<Promise<RuleNamespace[]>>;
  getAllRulesSourceNames().forEach(async (name) => {
    namespaces.push(
      fetchRules(name).catch((e) => {
        return [];
        // TODO add error comms
      })
    );
  });
  const promises = await Promise.all(namespaces);
  return promises.flat();
}
