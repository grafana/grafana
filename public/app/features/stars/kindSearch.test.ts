import { http, HttpResponse } from 'msw';

import { setBackendSrv } from '@grafana/runtime';
import { getKindDiscoveryHandler, getKindSearchHandler, kindSearchRoute } from '@grafana/test-utils/handlers';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { MOCK_STARRED_KIND, MOCK_STARRED_KIND_APP, MOCK_STARRED_KIND_SERVED } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';

import { searchStarredResources } from './kindSearch';
import { findStarredKindBySearchKind, initStarredKinds, type StarredKind } from './kinds';

setBackendSrv(backendSrv);
setupMockServer();

const THING = `${MOCK_STARRED_KIND.group}/${MOCK_STARRED_KIND.kind}`;
const THING_RESOURCE = { name: 't1', resource: 'things', title: 'Thing 1', folder: '', description: '', tags: [] };

describe('searchStarredResources', () => {
  let thing: StarredKind;
  let requests: Array<Record<string, unknown>> = [];

  const captureHandler = (items: unknown[] = []) =>
    http.post(kindSearchRoute(MOCK_STARRED_KIND_SERVED), async ({ request }) => {
      requests.push((await request.json()) as Record<string, unknown>);
      return HttpResponse.json({ metadata: { totalHits: items.length, totalHitsRelation: 'eq' }, items });
    });

  beforeAll(() => {
    initStarredKinds([MOCK_STARRED_KIND_APP]);
    thing = findStarredKindBySearchKind(THING)!;
  });

  afterAll(() => initStarredKinds([]));

  beforeEach(() => {
    requests = [];
    jest.restoreAllMocks();
    server.use(getKindDiscoveryHandler(MOCK_STARRED_KIND_SERVED));
  });

  // First on purpose: discovery is cached once it succeeds, so only the first call of the file sees a cold cache
  it('resolves to nothing when discovery fails, and discovers again on the next call', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const discovery = jest.fn(() => new HttpResponse(null, { status: 503 }));
    server.use(http.get('/apis', discovery));

    expect(await searchStarredResources(thing, ['t1'])).toEqual([]);
    expect(discovery).toHaveBeenCalledTimes(1);

    server.use(
      getKindDiscoveryHandler(MOCK_STARRED_KIND_SERVED),
      getKindSearchHandler(MOCK_STARRED_KIND_SERVED, [THING_RESOURCE])
    );
    expect(await searchStarredResources(thing, ['t1'])).toEqual([THING_RESOURCE]);
  });

  it('returns nothing and sends no request when no names are given', async () => {
    server.use(captureHandler());

    expect(await searchStarredResources(thing, [])).toEqual([]);
    expect(requests).toHaveLength(0);
  });

  it('finds the served version and plural through discovery, then asks that kind for the names', async () => {
    server.use(captureHandler());

    await searchStarredResources(thing, ['t1', 't2']);

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

    await searchStarredResources(thing, ['t1'], { text: 'cpu', tags: ['prod', 'eu'], folder: 'f1' });

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

    await searchStarredResources(thing, ['t1'], { text: '*' });

    expect(requests[0].where).toEqual({ filter: { field: 'name', operator: 'In', values: ['t1'] } });
  });

  it('maps hits to resources, falling back to the name as title and to an empty folder', async () => {
    server.use(
      getKindSearchHandler(MOCK_STARRED_KIND_SERVED, [
        { name: 't1', title: 'CPU saturation', folder: 'f1', description: 'Hot nodes', tags: ['prod'] },
        { name: 't2', title: '' },
      ])
    );

    expect(await searchStarredResources(thing, ['t1', 't2'])).toEqual([
      { ...THING_RESOURCE, title: 'CPU saturation', folder: 'f1', description: 'Hot nodes', tags: ['prod'] },
      { ...THING_RESOURCE, name: 't2', title: 't2' },
    ]);
  });

  it('resolves to nothing for a kind discovery does not list', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    const ghost: StarredKind = { ...thing, group: 'gone.ext.grafana.app', kind: 'Ghost' };

    expect(await searchStarredResources(ghost, ['g1'])).toEqual([]);
    expect(error).toHaveBeenCalledWith(
      'Failed to resolve starred gone.ext.grafana.app/Ghost',
      new Error('Kind gone.ext.grafana.app/Ghost is not served')
    );
  });

  it('warns and resolves to nothing when the kind has no search route', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    server.use(http.post(kindSearchRoute(MOCK_STARRED_KIND_SERVED), () => new HttpResponse(null, { status: 404 })));

    expect(await searchStarredResources(thing, ['t1'])).toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('does not enable search'));
  });

  it('resolves to nothing when the search endpoint fails', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    server.use(http.post(kindSearchRoute(MOCK_STARRED_KIND_SERVED), () => new HttpResponse(null, { status: 500 })));

    expect(await searchStarredResources(thing, ['t1'])).toEqual([]);
    expect(error).toHaveBeenCalledWith(`Failed to resolve starred ${THING}`, expect.objectContaining({ status: 500 }));
  });
});
