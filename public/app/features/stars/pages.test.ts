import { http, HttpResponse } from 'msw';

import { setBackendSrv } from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';

import { loadStarredPages } from './pages';

setBackendSrv(backendSrv);
setupMockServer();

const endpoint = '/api/plugins/grafana-assistant-app/resources/api/v1/page-catalog';
const first = '12345678-1234-4321-8765-123456789abc';
const second = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

it('follows empty permission-filtered batches and resolves only starred Page IDs', async () => {
  const cursors: Array<string | null> = [];
  server.use(
    http.get(endpoint, ({ request }) => {
      const url = new URL(request.url);
      expect(url.searchParams.get('section')).toBe('starred');
      cursors.push(url.searchParams.get('cursor'));
      return HttpResponse.json({
        data:
          cursors.length === 1
            ? { pages: [], nextCursor: 'continue' }
            : {
                pages: [
                  { id: first, title: 'CPU report' },
                  { id: second, title: 'Not starred' },
                ],
              },
      });
    })
  );
  expect(await loadStarredPages([first], 50)).toEqual([
    {
      id: `page:${first}`,
      title: 'CPU report',
      url: `/a/grafana-assistant-app/pages/${first}`,
      icon: 'file-alt',
      sortWeight: 2,
    },
  ]);
  expect(cursors).toEqual([null, 'continue']);
});

it.each([403, 404])('omits inaccessible or disabled Pages (%s)', async (status) => {
  server.use(http.get(endpoint, () => new HttpResponse(null, { status })));
  expect(await loadStarredPages([first], 50)).toEqual([]);
});

it('reports a retryable catalog failure', async () => {
  server.use(http.get(endpoint, () => new HttpResponse(null, { status: 503 })));
  await expect(loadStarredPages([first], 50)).rejects.toMatchObject({ status: 503 });
});

it('rejects malformed metadata', async () => {
  server.use(http.get(endpoint, () => HttpResponse.json({ data: { pages: [{ id: '../outside', title: 'bad' }] } })));
  await expect(loadStarredPages([first], 50)).rejects.toThrow();
});

it('caps visible entries and bounds permission scans', async () => {
  let calls = 0;
  server.use(
    http.get(endpoint, () => {
      calls++;
      return HttpResponse.json({ data: { pages: [], nextCursor: `cursor-${calls}` } });
    })
  );
  expect(await loadStarredPages([first], 50)).toEqual([]);
  expect(calls).toBe(5);
  server.use(
    http.get(endpoint, () =>
      HttpResponse.json({
        data: {
          pages: [
            { id: first, title: 'First' },
            { id: second, title: 'Second' },
          ],
        },
      })
    )
  );
  expect(await loadStarredPages([first, second], 1)).toEqual([expect.objectContaining({ title: 'First' })]);
});

it('does not contact an absent plugin when there are no Page stars or no space', async () => {
  expect(await loadStarredPages([], 50)).toEqual([]);
  expect(await loadStarredPages([first], 0)).toEqual([]);
});
