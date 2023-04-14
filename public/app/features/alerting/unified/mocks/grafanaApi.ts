import { rest } from 'msw';
import { SetupServer } from 'msw/node';

import { DashboardSearchItem } from '../../../search/types';

export function mockSearchApiResponse(server: SetupServer, searchResult: DashboardSearchItem[]) {
  server.use(rest.get('/api/search', (req, res, ctx) => res(ctx.json<DashboardSearchItem[]>(searchResult))));
}
