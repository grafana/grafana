import { rest } from 'msw';
import { SetupServerApi } from 'msw/node';

import { RulerRuleGroupDTO, RulerRulesConfigDTO } from '../../../../types/unified-alerting-dto';

export function mockRulerRulesApiResponse(
  server: SetupServerApi,
  rulesSourceName: string,
  response: RulerRulesConfigDTO
) {
  server.use(
    rest.get(`/api/ruler/${rulesSourceName}/api/v1/rules`, (req, res, ctx) =>
      res(ctx.json<RulerRulesConfigDTO>(response))
    )
  );
}

export function mockRulerRulesGroupApiResponse(
  server: SetupServerApi,
  rulesSourceName: string,
  namespace: string,
  group: string,
  response: RulerRuleGroupDTO
) {
  server.use(
    rest.get(`/api/ruler/${rulesSourceName}/api/v1/rules/${namespace}/${group}`, (req, res, ctx) =>
      res(ctx.json(response))
    )
  );
}
