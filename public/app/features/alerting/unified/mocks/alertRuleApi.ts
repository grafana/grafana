import { rest } from 'msw';
import { SetupServer } from 'msw/node';

import { DataFrameJSON } from '@grafana/data';

import { PREVIEW_URL } from '../api/alertRuleApi';

export function mockPreviewApiResponse(server: SetupServer, result: DataFrameJSON) {
  server.use(rest.post(PREVIEW_URL, (req, res, ctx) => res(ctx.json<DataFrameJSON>(result))));
}
