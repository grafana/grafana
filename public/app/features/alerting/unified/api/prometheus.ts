import { getBackendSrv } from '@grafana/runtime';
import { RuleNamespace } from 'app/types/unified-alerting';
import { PromRulesResponse } from 'app/types/unified-alerting-dto';
import { getDatasourceAPIId } from '../utils/datasource';

export async function fetchRules(dataSourceName: string): Promise<RuleNamespace[]> {
  const response = await getBackendSrv()
    .fetch<PromRulesResponse>({
      url: `/api/prometheus/${getDatasourceAPIId(dataSourceName)}/api/v1/rules`,
      showErrorAlert: false,
      showSuccessAlert: false,
    })
    .toPromise()
    .catch((e) => {
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
