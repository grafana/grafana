import { rest } from 'msw';
import { PREVIEW_URL, PROM_RULES_URL } from '../api/alertRuleApi';
export function mockPreviewApiResponse(server, result) {
    server.use(rest.post(PREVIEW_URL, (req, res, ctx) => res(ctx.json(result))));
}
export function mockPromRulesApiResponse(server, result) {
    server.use(rest.get(PROM_RULES_URL, (req, res, ctx) => res(ctx.json(result))));
}
//# sourceMappingURL=alertRuleApi.js.map