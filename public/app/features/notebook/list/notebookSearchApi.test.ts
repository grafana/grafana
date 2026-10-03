import { HttpResponse, http } from 'msw';

import { setBackendSrv } from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { dashboardAPIv2beta1 } from 'app/api/clients/dashboard/v2beta1';
import { backendSrv } from 'app/core/services/backend_srv';
import { configureStore } from 'app/store/configureStore';
import { dispatch } from 'app/types/store';

import { searchNotebookTitles } from './notebookSearchApi';
import { __resetSearchAvailabilityForTests, markNotebookSearchUnavailable } from './notebookSearchAvailability';

const NOTEBOOKS_URL = '/apis/dashboard.grafana.app/v2beta1/namespaces/:namespace/notebooks';
const NOTEBOOKS_SEARCH_URL = `${NOTEBOOKS_URL}/search`;

setBackendSrv(backendSrv);
setupMockServer();

const hit = {
  resource: { group: 'dashboard.grafana.app', resource: 'notebooks', kind: 'Notebook', name: 'nb1' },
  fields: { title: 'Incident notes' },
};

/** Records every search body that reached the endpoint, and answers each with `respond`. */
function captureSearches(respond: () => Response) {
  const bodies: unknown[] = [];
  server.use(
    http.post(NOTEBOOKS_SEARCH_URL, async ({ request }) => {
      bodies.push(await request.json());
      return respond();
    })
  );
  return bodies;
}

/** Fails the test if the full-notebook LIST endpoint is reached — the fallback must stay unused. */
function failOnNotebookList() {
  const listed: string[] = [];
  server.use(
    http.get(NOTEBOOKS_URL, ({ request }) => {
      listed.push(request.url);
      return HttpResponse.json({ items: [] });
    })
  );
  return listed;
}

describe('searchNotebookTitles', () => {
  // A fresh store per case, so one case's cached entries cannot answer the next case's search.
  beforeEach(() => {
    configureStore();
  });

  afterEach(() => {
    __resetSearchAvailabilityForTests();
  });

  it('asks the search endpoint for title matches, projected down to the title', async () => {
    const bodies = captureSearches(() => HttpResponse.json({ items: [hit] }));

    await expect(searchNotebookTitles('Incident', 10)).resolves.toEqual([hit]);
    expect(bodies).toEqual([
      {
        apiVersion: 'search.grafana.app/v0alpha1',
        kind: 'SearchQuery',
        where: { text: { value: 'Incident', fields: ['title'] } },
        fields: ['title'],
        limit: 10,
      },
    ]);
  });

  it.each([404, 405])('skips later searches without fetching full notebooks after a %i', async (status) => {
    const bodies = captureSearches(() => HttpResponse.json({}, { status }));
    const listed = failOnNotebookList();

    await expect(searchNotebookTitles('incident', 10)).resolves.toEqual([]);
    await expect(searchNotebookTitles('another', 10)).resolves.toEqual([]);

    expect(bodies).toHaveLength(1);
    expect(listed).toHaveLength(0);
  });

  it('skips search when the notebook list already found the route missing', async () => {
    markNotebookSearchUnavailable({ status: 404, data: {} });
    const bodies = captureSearches(() => HttpResponse.json({ items: [hit] }));

    await expect(searchNotebookTitles('incident', 10)).resolves.toEqual([]);
    expect(bodies).toHaveLength(0);
  });

  // Results are cached per query string, so a notebook deleted between two identical searches would
  // otherwise keep showing up until the entry aged out. The endpoint tags itself into the `Notebook`
  // namespace that the generated mutations invalidate, which drops the entry.
  it('stops serving a cached result once a notebook mutation invalidates it', async () => {
    const bodies = captureSearches(() => HttpResponse.json({ items: [hit] }));
    server.use(http.delete(`${NOTEBOOKS_URL}/:name`, () => HttpResponse.json({})));

    await expect(searchNotebookTitles('Incident', 10)).resolves.toEqual([hit]);
    // Same query string: served from cache, so the endpoint is not asked again.
    await expect(searchNotebookTitles('Incident', 10)).resolves.toEqual([hit]);
    expect(bodies).toHaveLength(1);

    await dispatch(dashboardAPIv2beta1.endpoints.deleteNotebook.initiate({ name: 'nb1' }));
    // Nothing subscribes to the entry, so invalidating it drops it outright. Were it subscribed,
    // RTK would refetch here instead, and this count would already be 2.
    expect(bodies).toHaveLength(1);

    await expect(searchNotebookTitles('Incident', 10)).resolves.toEqual([hit]);
    expect(bodies).toHaveLength(2);
  });

  it('does not read a 404 as absence once search has answered', async () => {
    let status = 200;
    const bodies = captureSearches(() =>
      status === 200 ? HttpResponse.json({ items: [] }) : HttpResponse.json({}, { status })
    );

    await expect(searchNotebookTitles('incident', 10)).resolves.toEqual([]);
    status = 404;

    await expect(searchNotebookTitles('another', 10)).rejects.toEqual(expect.objectContaining({ status: 404 }));
    expect(bodies).toHaveLength(2);
  });
});
