import { rest } from 'msw';
export function mockPluginSettings(server, plugin, response) {
    server.use(rest.get(`/api/plugins/${plugin}/settings`, (_req, res, ctx) => {
        return response ? res(ctx.status(200), ctx.json(response)) : res(ctx.status(404));
    }));
}
//# sourceMappingURL=plugins.js.map