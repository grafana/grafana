import { HttpResponse, http } from 'msw';
import { type SetupServer } from 'msw/node';

import { type TemplatePreviewResponse, previewTemplateUrl } from '../api/templateApi';

export function mockPreviewTemplateResponse(server: SetupServer, response: TemplatePreviewResponse) {
  server.use(http.post(previewTemplateUrl, () => HttpResponse.json(response)));
}

export const REJECTED_PREVIEW_RESPONSE = 'error, something went wrong';

export function mockPreviewTemplateResponseRejected(server: SetupServer) {
  server.use(http.post(previewTemplateUrl, () => HttpResponse.json(REJECTED_PREVIEW_RESPONSE, { status: 500 })));
}
