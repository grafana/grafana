import { rest } from 'msw';
import { SetupServer } from 'msw/node';

import { PromRulesResponse } from 'app/types/unified-alerting-dto';

import { PreviewResponse, PREVIEW_URL, PROM_RULES_URL } from '../api/alertRuleApi';

export function mockPreviewApiResponse(server: SetupServer, result: PreviewResponse) {
  server.use(rest.post(PREVIEW_URL, (req, res, ctx) => res(ctx.json<PreviewResponse>(result))));
}

export function mockPromRulesApiResponse(server: SetupServer, result: PromRulesResponse) {
  server.use(rest.get(PROM_RULES_URL, (req, res, ctx) => res(ctx.json<PromRulesResponse>(result))));
}
