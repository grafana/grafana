import { rest } from 'msw';
import { SetupServer } from 'msw/node';

import { PromRulesResponse } from 'app/types/unified-alerting-dto';

import { PROM_RULES_URL } from '../api/alertRuleApi';

export function mockPromRulesApiResponse(server: SetupServer, result: PromRulesResponse) {
  server.use(rest.get(PROM_RULES_URL, (req, res, ctx) => res(ctx.json<PromRulesResponse>(result))));
}
