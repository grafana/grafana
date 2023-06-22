import { rest } from 'msw';
import { SetupServer } from 'msw/node';

import { RuleNamespace } from 'app/types/unified-alerting';

import { PreviewResponse, PREVIEW_URL, PROM_RULES_URL } from '../api/alertRuleApi';

export function mockPreviewApiResponse(server: SetupServer, result: PreviewResponse) {
  server.use(rest.post(PREVIEW_URL, (req, res, ctx) => res(ctx.json<PreviewResponse>(result))));
}

export function mockPromRulesApiResponse(server: SetupServer, result: RuleNamespace[]) {
  server.use(rest.get(PROM_RULES_URL, (req, res, ctx) => res(ctx.json<RuleNamespace[]>(result))));
}
