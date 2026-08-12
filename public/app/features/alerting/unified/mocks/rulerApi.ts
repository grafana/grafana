import { HttpResponse, http } from 'msw';
import { type SetupServer } from 'msw/node';

import { type RulerRuleGroupDTO, type RulerRulesConfigDTO } from '../../../../types/unified-alerting-dto';

export function mockRulerRulesApiResponse(server: SetupServer, rulesSourceName: string, response: RulerRulesConfigDTO) {
  server.use(http.get(`/api/ruler/${rulesSourceName}/api/v1/rules`, () => HttpResponse.json(response)));
}

export function mockRulerRulesGroupApiResponse(
  server: SetupServer,
  rulesSourceName: string,
  namespace: string,
  group: string,
  response: RulerRuleGroupDTO
) {
  server.use(
    http.get(`/api/ruler/${rulesSourceName}/api/v1/rules/${namespace}/${group}`, () => HttpResponse.json(response))
  );
}
