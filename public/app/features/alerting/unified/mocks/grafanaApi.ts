import { rest } from 'msw';
import { SetupServerApi } from 'msw/node';

import { DashboardSearchItem } from '../../../search/types';

export function mockSearchApiResponse(server: SetupServerApi, searchResult: DashboardSearchItem[]) {
  server.use(rest.get('/api/search', (req, res, ctx) => res(ctx.json<DashboardSearchItem[]>(searchResult))));
}
