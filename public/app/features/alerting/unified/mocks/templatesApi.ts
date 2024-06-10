import 'whatwg-fetch';
import { http, HttpResponse } from 'msw';
import { SetupServer } from 'msw/node';

import { previewTemplateUrl, TemplatePreviewResponse } from '../api/templateApi';

export function mockPreviewTemplateResponse(server: SetupServer, response: TemplatePreviewResponse) {
  server.use(http.post(previewTemplateUrl, () => HttpResponse.json(response)));
}

export function mockPreviewTemplateResponseRejected(server: SetupServer) {
  server.use(http.post(previewTemplateUrl, () => HttpResponse.json('error', { status: 500 })));
}
