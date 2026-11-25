import { http, HttpResponse } from 'msw';
import { testWithAppKind } from 'test/helpers/testWithAppKind';
import { act, getWrapper, renderHook, waitFor } from 'test/test-utils';

import { type SearchQuery } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { AppEvents } from '@grafana/data';
import { setBackendSrv } from '@grafana/runtime';
import { getAPIGroupHandler, getKindSearchHandler, kindSearchRoute } from '@grafana/test-utils/handlers';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { MOCK_APP_KIND } from '@grafana/test-utils/unstable';
import { appEvents } from 'app/core/app_events';
import { backendSrv } from 'app/core/services/backend_srv';

import { useSearchStarredAppKindsQuery } from './kindSearch';

const { group: GROUP, kind: KIND, version: VERSION, resource: RESOURCE } = MOCK_APP_KIND;
const THING = 't1';
const OTHER_THING = 't2';
// A version the kind is no longer searched at, for a group that still prefers it
const RETIRED_VERSION = 'v0alpha0';

setBackendSrv(backendSrv);
setupMockServer();
testWithAppKind();

/** Searches for the starred objects of the test app kind that have these names. */
const searchStarred = (names: string[]) =>
  renderHook(() => useSearchStarredAppKindsQuery([{ kind: 'things.ext.grafana.app/Thing', names }]), {
    wrapper: getWrapper({}),
  });

/** A hit, as the search of the kind answers with. */
const hit = (name: string, title: string) => ({
  resource: { group: GROUP, resource: RESOURCE, kind: KIND, name },
  fields: { title },
});

describe('useSearchStarredAppKindsQuery', () => {
  beforeEach(() => {
    server.use(getAPIGroupHandler(GROUP, VERSION));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('asks the search of the kind for the starred names alone', async () => {
    const queries: unknown[] = [];
    server.use(
      http.post(kindSearchRoute(MOCK_APP_KIND), async ({ request }) => {
        queries.push(await request.json());
        return HttpResponse.json({ metadata: { totalHits: 0, totalHitsRelation: 'eq' }, items: [] });
      })
    );

    const { result } = searchStarred([THING]);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    // The server decodes strictly, so the whole body is the contract
    expect(queries).toEqual([
      {
        apiVersion: 'search.grafana.app/v0alpha1',
        kind: 'SearchQuery',
        where: { filter: { field: 'name', operator: 'In', values: [THING] } },
        fields: ['title', 'folder', 'description'],
        limit: 1,
      },
    ]);
  });

  it('answers with a row for the object, which links to the page of the object', async () => {
    server.use(
      getKindSearchHandler(MOCK_APP_KIND, [
        { name: THING, title: 'My Thing', folder: 'folder-a', description: 'About the thing' },
      ])
    );

    const { result } = searchStarred([THING]);

    await waitFor(() => {
      expect(result.current.data).toEqual([
        {
          kind: 'things.ext.grafana.app/Thing',
          uid: 't1',
          name: 'My Thing',
          url: '/a/test-things-app/things/t1',
          description: 'About the thing',
          location: 'folder-a',
        },
      ]);
    });
  });

  it('names a row after the object when it has no title', async () => {
    server.use(getKindSearchHandler(MOCK_APP_KIND, [{ name: THING, title: '' }]));

    const { result } = searchStarred([THING]);

    await waitFor(() => {
      expect(result.current.data?.map((row) => row.name)).toEqual(['t1']);
    });
  });

  it('finds every object of a star set larger than one page of the search', async () => {
    const names = Array.from({ length: 501 }, (_, index) => `t${index}`);
    server.use(
      getKindSearchHandler(
        MOCK_APP_KIND,
        names.map((name) => ({ name, title: name }))
      )
    );

    const { result } = searchStarred(names);

    await waitFor(() => {
      expect(result.current.data).toHaveLength(501);
    });
    expect(new Set(result.current.data?.map((row) => row.uid))).toEqual(new Set(names));
  });

  it('asks again when a page stops short of the starred names', async () => {
    const tokens: Array<string | undefined> = [];
    server.use(
      http.post<{ namespace: string }, SearchQuery>(kindSearchRoute(MOCK_APP_KIND), async ({ request }) => {
        const query = await request.json();
        tokens.push(query.continue);
        // The server may cut a page short; it then hands out a token for the rest
        return HttpResponse.json(
          query.continue
            ? { metadata: { totalHits: 2, totalHitsRelation: 'lte' }, items: [hit(OTHER_THING, 'Second page')] }
            : {
                metadata: { totalHits: 2, totalHitsRelation: 'lte', continue: 'rest' },
                items: [hit(THING, 'First page')],
              }
        );
      })
    );

    const { result } = searchStarred([THING, OTHER_THING]);

    await waitFor(() => {
      expect(result.current.data?.map((row) => row.name)).toEqual(['First page', 'Second page']);
    });
    expect(tokens).toEqual([undefined, 'rest']);
  });

  it('asks once when a page holds every starred name, though it comes with a token', async () => {
    // The server hands out a token with a full page, as it cannot tell whether more would follow
    const asked = jest.fn(() =>
      HttpResponse.json({
        metadata: { totalHits: 2, totalHitsRelation: 'lte', continue: 'more' },
        items: [hit(THING, 'First'), hit(OTHER_THING, 'Second')],
      })
    );
    server.use(http.post(kindSearchRoute(MOCK_APP_KIND), asked));

    const { result } = searchStarred([THING, OTHER_THING]);

    await waitFor(() => {
      expect(result.current.data).toHaveLength(2);
    });
    expect(asked).toHaveBeenCalledTimes(1);
  });

  it('stops asking a search that hands out a token with every page', async () => {
    const asked = jest.fn(() =>
      HttpResponse.json({ metadata: { totalHits: 1, totalHitsRelation: 'lte', continue: 'more' }, items: [] })
    );
    server.use(http.post(kindSearchRoute(MOCK_APP_KIND), asked));

    const { result } = searchStarred([THING]);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    // A page accounts for one name at least, so one starred name is one page at most
    expect(asked).toHaveBeenCalledTimes(1);
  });

  it.each([
    { desc: 'cannot be read', first: http.get(`/apis/${GROUP}/`, () => new HttpResponse(null, { status: 503 })) },
    { desc: 'prefers a version since retired', first: getAPIGroupHandler(GROUP, RETIRED_VERSION) },
  ])('finds the object on the next search, when its API group first $desc', async ({ first }) => {
    server.use(
      first,
      http.post(
        kindSearchRoute({ ...MOCK_APP_KIND, version: RETIRED_VERSION }),
        () => new HttpResponse(null, { status: 404 })
      ),
      getKindSearchHandler(MOCK_APP_KIND, [{ name: THING, title: 'My Thing' }])
    );
    // A group that cannot be read is logged, and so is a search at a version no longer served
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = searchStarred([THING]);
    await waitFor(() => {
      expect(result.current.data).toEqual([]);
    });

    // The plugin is back at its current version; the version is asked for with every search, not kept
    server.use(getAPIGroupHandler(GROUP, VERSION));
    act(() => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.data?.map((row) => row.name)).toEqual(['My Thing']);
    });
  });

  it.each([405, 404, 503])('leaves the kind out, without an error, when its search answers %s', async (status) => {
    const asked = jest.fn(() => new HttpResponse(null, { status }));
    server.use(http.post(kindSearchRoute(MOCK_APP_KIND), asked));
    // The failed search is logged
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = searchStarred([THING]);

    // A kind's API is served by its plugin and may be absent: not an error, its objects are simply not shown
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(asked).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual([]);
  });

  it('asks no search of a kind whose API group the instance does not serve', async () => {
    const asked = jest.fn(() => new HttpResponse(null, { status: 404 }));
    server.use(getAPIGroupHandler(GROUP), http.post(kindSearchRoute(MOCK_APP_KIND), asked));

    const { result } = searchStarred([THING]);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual([]);
    expect(asked).not.toHaveBeenCalled();
  });

  it('raises no toast when the search fails', async () => {
    server.use(http.post(kindSearchRoute(MOCK_APP_KIND), () => new HttpResponse(null, { status: 503 })));
    // The failed search is logged
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const alertDecided = jest.spyOn(backendSrv, 'showErrorAlert');
    const emit = jest.spyOn(appEvents, 'emit');

    searchStarred([THING]);

    // The backend service decides on an alert a moment after a request fails
    await waitFor(() => {
      expect(alertDecided).toHaveBeenCalledWith(
        expect.objectContaining({ url: expect.stringContaining('things/search') }),
        expect.anything()
      );
    });
    expect(emit).not.toHaveBeenCalledWith(AppEvents.alertError, expect.anything());
  });
});
