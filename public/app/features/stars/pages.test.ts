import { http, HttpResponse } from 'msw';

import { setBackendSrv } from '@grafana/runtime';
import { getPagesSearchHandler, pagesSearchRoute } from '@grafana/test-utils/handlers';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';

import { searchStarredPages } from './pages';

setBackendSrv(backendSrv);
setupMockServer();

describe('searchStarredPages', () => {
  let requests: Array<Record<string, unknown>> = [];

  const captureHandler = (items: unknown[] = []) =>
    http.post(pagesSearchRoute, async ({ request }) => {
      requests.push((await request.json()) as Record<string, unknown>);
      return HttpResponse.json({ items });
    });

  beforeEach(() => {
    requests = [];
  });

  it('returns no pages and sends no request when no names are given', async () => {
    server.use(captureHandler());

    expect(await searchStarredPages([])).toEqual([]);
    expect(requests).toHaveLength(0);
  });

  it('sends a bare name filter leaf when no other filter applies', async () => {
    server.use(captureHandler());

    await searchStarredPages(['p1', 'p2']);

    expect(requests).toEqual([
      {
        apiVersion: 'search.grafana.app/v0alpha1',
        kind: 'SearchQuery',
        where: { filter: { field: 'name', operator: 'In', values: ['p1', 'p2'] } },
        fields: ['title', 'folder', 'description', 'tags'],
        limit: 2,
      },
    ]);
  });

  it('ands the name, text, tags and folder leaves in that order', async () => {
    server.use(captureHandler());

    await searchStarredPages(['p1'], { text: 'cpu', tags: ['prod', 'eu'], folder: 'f1' });

    expect(requests[0].where).toEqual({
      and: [
        { filter: { field: 'name', operator: 'In', values: ['p1'] } },
        { text: { value: 'cpu', fields: ['title', 'description'] } },
        { filter: { field: 'tags', operator: 'All', values: ['prod', 'eu'] } },
        { filter: { field: 'folder', operator: 'In', values: ['f1'] } },
      ],
    });
  });

  it('treats the match-all query "*" as no text filter', async () => {
    server.use(captureHandler());

    await searchStarredPages(['p1'], { text: '*' });

    expect(requests[0].where).toEqual({ filter: { field: 'name', operator: 'In', values: ['p1'] } });
  });

  it('maps hits to pages, falling back to the name as title and to an empty folder', async () => {
    server.use(
      getPagesSearchHandler([
        { name: 'p1', title: 'CPU saturation', folder: 'f1', description: 'Hot nodes', tags: ['prod'] },
        { name: 'p2', title: '' },
      ])
    );

    expect(await searchStarredPages(['p1', 'p2'])).toEqual([
      { name: 'p1', title: 'CPU saturation', folder: 'f1', description: 'Hot nodes', tags: ['prod'] },
      { name: 'p2', title: 'p2', folder: '', description: '', tags: [] },
    ]);
  });

  it('rejects when the endpoint is unavailable', async () => {
    server.use(http.post(pagesSearchRoute, () => new HttpResponse(null, { status: 404 })));

    await expect(searchStarredPages(['p1'])).rejects.toMatchObject({ status: 404 });
  });
});
