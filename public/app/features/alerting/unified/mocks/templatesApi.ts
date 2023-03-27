import { rest } from 'msw';
import { SetupServer } from 'msw/node';

import {
  defaultPayloadUrl,
  previewTemplateUrl,
  TemplateDefaultPayloadResponse,
  TemplatesPreviewResponse,
} from '../api/templateApi';

export function mockDefaultPayloadResponse(server: SetupServer, response: TemplateDefaultPayloadResponse) {
  server.use(rest.get(defaultPayloadUrl, (req, res, ctx) => res(ctx.status(200), ctx.json(response))));
}

export function mockDefaultPayloadResponseRejected(server: SetupServer) {
  server.use(rest.get(defaultPayloadUrl, (req, res, ctx) => res(ctx.status(500), ctx.json('error'))));
}

export function mockPreviewTemplateResponse(server: SetupServer, response: TemplatesPreviewResponse) {
  server.use(rest.get(previewTemplateUrl, (req, res, ctx) => res(ctx.status(200), ctx.json(response))));
}
