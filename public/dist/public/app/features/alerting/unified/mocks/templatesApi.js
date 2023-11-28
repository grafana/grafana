import { rest } from 'msw';
import { previewTemplateUrl } from '../api/templateApi';
export function mockPreviewTemplateResponse(server, response) {
    server.use(rest.post(previewTemplateUrl, (req, res, ctx) => res(ctx.status(200), ctx.json(response))));
}
export function mockPreviewTemplateResponseRejected(server) {
    server.use(rest.post(previewTemplateUrl, (req, res, ctx) => res(ctx.status(500), ctx.json('error'))));
}
//# sourceMappingURL=templatesApi.js.map