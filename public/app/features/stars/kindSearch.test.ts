import { http, HttpResponse } from 'msw';

import { setBackendSrv } from '@grafana/runtime';
import { clearAppPluginMetas, setAppPluginMetas } from '@grafana/runtime/internal';
import { getKindDiscoveryHandlers, getKindSearchHandler, kindSearchRoute } from '@grafana/test-utils/handlers';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { MOCK_STARRED_KIND, MOCK_STARRED_KIND_APP, MOCK_STARRED_KIND_SERVED } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';

import { searchStarredResources } from './kindSearch';
import { loadStarredKinds, type StarredKind } from './kinds';

setBackendSrv(backendSrv);
setupMockServer();

describe('searchStarredResources', () => {
  let thing: StarredKind;
  let requests: Array<Record<string, unknown>> = [];
  const discovery = jest.fn();

  const captureHandler = (items: unknown[] = []) =>
    http.post(kindSearchRoute(MOCK_STARRED_KIND_SERVED), async ({ request }) => {
      requests.push((await request.json()) as Record<string, unknown>);
      return HttpResponse.json({ items });
    });

  beforeAll(async () => {
    setAppPluginMetas({ [MOCK_STARRED_KIND_APP.id]: MOCK_STARRED_KIND_APP });
    thing = (await loadStarredKinds()).find((kind) => kind.kind === MOCK_STARRED_KIND.kind)!;
  });

  afterAll(() => clearAppPluginMetas());

  beforeEach(() => {
    requests = [];
    discovery.mockClear();
    server.use(
      ...getKindDiscoveryHandlers(MOCK_STARRED_KIND_SERVED).map((handler) => {
        // Count discovery requests through a wrapper so the cache can be asserted
        const original = handler.run.bind(handler);
        handler.run = (args) => {
          discovery();
          return original(args);
        };
        return handler;
      })
    );
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
      { name: 't1', title: 'CPU saturation', folder: 'f1', description: 'Hot nodes', tags: ['prod'] },
      { name: 't2', title: 't2', folder: '', description: '', tags: [] },
    ]);
  });

  it('rejects when the kind is not served, and discovers again on the next call', async () => {
    const other: StarredKind = { ...thing, group: 'gone.ext.grafana.app', kind: 'Ghost' };
    server.use(http.get(`/apis/${other.group}/`, () => new HttpResponse(null, { status: 404 })));

    await expect(searchStarredResources(other, ['g1'])).rejects.toThrow('API group gone.ext.grafana.app is not served');

    server.use(
      ...getKindDiscoveryHandlers({ group: other.group, version: 'v1', kind: other.kind, plural: 'ghosts' }),
      getKindSearchHandler({ group: other.group, version: 'v1', kind: other.kind, plural: 'ghosts' }, [
        { name: 'g1', title: 'Ghost 1' },
      ])
    );
    expect(await searchStarredResources(other, ['g1'])).toEqual([
      { name: 'g1', title: 'Ghost 1', folder: '', description: '', tags: [] },
    ]);
  });

  it('rejects when the search endpoint fails', async () => {
    server.use(http.post(kindSearchRoute(MOCK_STARRED_KIND_SERVED), () => new HttpResponse(null, { status: 500 })));

    await expect(searchStarredResources(thing, ['t1'])).rejects.toMatchObject({ status: 500 });
  });
});
