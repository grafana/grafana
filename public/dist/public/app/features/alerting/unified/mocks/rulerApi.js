import { rest } from 'msw';
export function mockRulerRulesApiResponse(server, rulesSourceName, response) {
    server.use(rest.get(`/api/ruler/${rulesSourceName}/api/v1/rules`, (req, res, ctx) => res(ctx.json(response))));
}
export function mockRulerRulesGroupApiResponse(server, rulesSourceName, namespace, group, response) {
    server.use(rest.get(`/api/ruler/${rulesSourceName}/api/v1/rules/${namespace}/${group}`, (req, res, ctx) => res(ctx.json(response))));
}
//# sourceMappingURL=rulerApi.js.map