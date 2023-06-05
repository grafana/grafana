import { rest } from 'msw';
import { SetupServer } from 'msw/node';

import { previewTemplateUrl, TemplatePreviewResponse } from '../api/templateApi';

export function mockPreviewTemplateResponse(server: SetupServer, response: TemplatePreviewResponse) {
  server.use(rest.post(previewTemplateUrl, (req, res, ctx) => res(ctx.status(200), ctx.json(response))));
}

export function mockPreviewTemplateResponseRejected(server: SetupServer) {
  server.use(rest.post(previewTemplateUrl, (req, res, ctx) => res(ctx.status(500), ctx.json('error'))));
}
