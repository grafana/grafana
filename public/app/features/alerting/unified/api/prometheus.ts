import { getBackendSrv } from '@grafana/runtime';
import { RuleNamespace } from 'app/types/unified-alerting';
import { PromRulesResponse } from 'app/types/unified-alerting-dto';
import { getDatasourceAPIId } from '../utils/datasource';

export async function fetchRules(dataSourceName: string): Promise<RuleNamespace[]> {
  const response = await getBackendSrv()
    .fetch<PromRulesResponse>({
      url: `/prometheus/${getDatasourceAPIId(dataSourceName)}/api/v1/rules`,
      showErrorAlert: false,
      showSuccessAlert: false,
    })
    .toPromise();

  if (response.status === 200 && (response.data.status === 'success' || response.data.status === '')) {
    const nsMap: { [key: string]: RuleNamespace } = {};
    response.data.data.groups.forEach((group) => {
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
  } else if (response.status === 404) {
    return [];
  } else {
    throw new Error(`http error status=${response.status} body=${JSON.stringify(response.data)}`);
  }
}
