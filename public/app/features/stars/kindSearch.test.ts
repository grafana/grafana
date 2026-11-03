import { http, HttpResponse } from 'msw';

import { setBackendSrv } from '@grafana/runtime';
import { getKindSearchHandler, kindSearchRoute } from '@grafana/test-utils/handlers';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { MOCK_STARRED_KIND_SERVED } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';

import { searchStarredHits } from './kindSearch';
import { type KindSearchStarredKind } from './kinds';

setBackendSrv(backendSrv);
setupMockServer();

const THING = `${MOCK_STARRED_KIND_SERVED.group}/${MOCK_STARRED_KIND_SERVED.kind}`;
const THING_HIT = {
  resource: 'things',
  kind: THING,
  name: 't1',
  title: 'Thing 1',
  folder: '',
  description: '',
  tags: [],
  field: {},
  url: '/a/test-things-app/things/t1',
};

describe('searchStarredHits', () => {
  const { group, kind, version, plural } = MOCK_STARRED_KIND_SERVED;
  const thing: KindSearchStarredKind = {
    group,
    kind,
    searchKind: THING,
    title: () => kind,
    icon: 'cube',
    sortWeight: 2,
    source: 'kind-search',
    version,
    resource: plural,
    url: (name) => `/a/test-things-app/things/${name}`,
  };
  let requests: Array<Record<string, unknown>> = [];

  const captureHandler = (items: unknown[] = []) =>
    http.post(kindSearchRoute(MOCK_STARRED_KIND_SERVED), async ({ request }) => {
      requests.push((await request.json()) as Record<string, unknown>);
      return HttpResponse.json({ metadata: { totalHits: items.length, totalHitsRelation: 'eq' }, items });
    });

  beforeEach(() => {
    requests = [];
    jest.restoreAllMocks();
  });

  it('returns nothing and sends no request when no names are given', async () => {
    server.use(captureHandler());

    expect(await searchStarredHits(thing, [])).toEqual([]);
    expect(requests).toHaveLength(0);
  });

  it("asks the kind's search route for the names", async () => {
    server.use(captureHandler());

    await searchStarredHits(thing, ['t1', 't2']);

    expect(requests).toEqual([
      {
        apiVersion: 'search.grafana.app/v0alpha1',
        kind: 'SearchQuery',
        where: { filter: { field: 'name', operator: 'In', values: ['t1', 't2'] } },
        fields: ['title', 'folder', 'description', 'tags'],
        limit: 2,
      },
    ]);
  });

  it('ands the name, text, tags and folder leaves in that order', async () => {
    server.use(captureHandler());

    await searchStarredHits(thing, ['t1'], { text: 'cpu', tags: ['prod', 'eu'], folder: 'f1' });

    expect(requests[0].where).toEqual({
      and: [
        { filter: { field: 'name', operator: 'In', values: ['t1'] } },
        { text: { value: 'cpu', fields: ['title', 'description'] } },
        { filter: { field: 'tags', operator: 'All', values: ['prod', 'eu'] } },
        { filter: { field: 'folder', operator: 'In', values: ['f1'] } },
      ],
    });
  });

  it('treats the match-all query "*" as no text filter', async () => {
    server.use(captureHandler());

    await searchStarredHits(thing, ['t1'], { text: '*' });

    expect(requests[0].where).toEqual({ filter: { field: 'name', operator: 'In', values: ['t1'] } });
  });

  it('asks the server to sort, so a page of several kinds needs no client ordering', async () => {
    server.use(captureHandler());

    await searchStarredHits(thing, ['t1'], { sort: { field: 'title', direction: 'desc' } });

    expect(requests[0].sort).toEqual([{ field: 'title', direction: 'desc' }]);
  });

  it("maps results to search hits of the kind, linking to the kind's page and falling back to the name as title", async () => {
    server.use(
      getKindSearchHandler(MOCK_STARRED_KIND_SERVED, [
        { name: 't1', title: 'CPU saturation', folder: 'f1', description: 'Hot nodes', tags: ['prod'] },
        { name: 't2', title: '' },
      ])
    );

    expect(await searchStarredHits(thing, ['t1', 't2'])).toEqual([
      { ...THING_HIT, title: 'CPU saturation', folder: 'f1', description: 'Hot nodes', tags: ['prod'] },
      { ...THING_HIT, name: 't2', title: 't2', url: '/a/test-things-app/things/t2' },
    ]);
  });

  it('warns and resolves to nothing when the kind has no search route', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    server.use(http.post(kindSearchRoute(MOCK_STARRED_KIND_SERVED), () => new HttpResponse(null, { status: 404 })));

    expect(await searchStarredHits(thing, ['t1'])).toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('does not enable search'));
  });

  it('resolves to nothing when the search endpoint fails', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    server.use(http.post(kindSearchRoute(MOCK_STARRED_KIND_SERVED), () => new HttpResponse(null, { status: 500 })));

    expect(await searchStarredHits(thing, ['t1'])).toEqual([]);
    expect(error).toHaveBeenCalledWith(`Failed to resolve starred ${THING}`, expect.objectContaining({ status: 500 }));
  });
});
