import { rest } from 'msw';
export function mockSearchApiResponse(server, searchResult) {
    server.use(rest.get('/api/search', (req, res, ctx) => res(ctx.json(searchResult))));
}
//# sourceMappingURL=grafanaApi.js.map