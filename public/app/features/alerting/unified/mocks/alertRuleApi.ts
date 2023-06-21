import { rest } from 'msw';
import { SetupServer } from 'msw/node';

import { PreviewResponse, PREVIEW_URL } from '../api/alertRuleApi';

export function mockPreviewApiResponse(server: SetupServer, result: PreviewResponse) {
  server.use(rest.post(PREVIEW_URL, (req, res, ctx) => res(ctx.json<PreviewResponse>(result))));
}
