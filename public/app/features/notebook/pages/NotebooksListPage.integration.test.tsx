import { HttpResponse, http } from 'msw';
import { render, screen, waitFor, act } from 'test/test-utils';

import { locationService, setBackendSrv } from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { __resetSearchAvailabilityForTests, NOTEBOOKS_PAGE_LIMIT } from '../list/useNotebooksList';

import { NotebooksListPage } from './NotebooksListPage';

// Deliberately no jest.mock of the api-client modules here: the point of this suite is to exercise
// the real RTK Query wiring, and to hold the real endpoint still so the test can say whether it was
// called at all. The mocked suite next door covers the rendering cases.

const NOTEBOOKS_FLAG = 'dashboard.notebooks';
const NOTEBOOKS_URL = '/apis/dashboard.grafana.app/v2beta1/namespaces/:namespace/notebooks';
const NOTEBOOKS_SEARCH_URL = `${NOTEBOOKS_URL}/search`;

// The api clients issue their requests through the backend service, which msw then intercepts.
setBackendSrv(backendSrv);
setupMockServer();

/** A notebook as the LIST endpoint returns it — used only for the fallback case. */
function notebook(name: string, title: string) {
  return {
    metadata: {
      name,
      creationTimestamp: '2026-01-01T00:00:00Z',
      // The display handler maps key `user:1` to identity name `u000000001`, mirroring the real
      // endpoint — so this row only resolves to a name if we remap by requested key.
      annotations: { 'grafana.app/createdBy': 'user:1' },
    },
    spec: {
      title,
      description: '',
      tags: [],
      elements: {},
      layout: { kind: 'NotebookLayout', spec: { cells: [] } },
      timeSettings: { from: 'now-6h', to: 'now' },
    },
  };
}

/** A search hit: the projected fields, not a whole notebook. */
function hit(name: string, title: string) {
  return {
    resource: { group: 'dashboard.grafana.app', resource: 'notebooks', kind: 'Notebook', name },
    fields: {
      title,
      tags: [],
      createdBy: 'user:1',
      created: Date.UTC(2026, 0, 1),
      updated: Date.UTC(2026, 1, 1),
    },
  };
}

/** Serves a search-backed list, counting searches and any attempt to create a notebook. */
function setupNotebooksApi() {
  const items = [hit('nb1', 'Checkout error spike')];
  let searchRequests = 0;
  let createRequests = 0;
  const bodies: Array<Record<string, unknown>> = [];

  server.use(
    http.post(NOTEBOOKS_SEARCH_URL, async ({ request }) => {
      searchRequests++;
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- shape asserted by the test
      bodies.push((await request.json()) as Record<string, unknown>);
      return HttpResponse.json({
        metadata: { totalHits: items.length, totalHitsRelation: 'eq' },
        items,
      });
    }),
    // Still served, so a create would succeed rather than error. A test that only proved the request
    // failed would pass for the wrong reason.
    http.post(NOTEBOOKS_URL, async () => {
      createRequests++;
      items.push(hit('nb2', 'New notebook'));
      return HttpResponse.json(notebook('nb2', 'New notebook'));
    })
  );

  return {
    getSearchRequests: () => searchRequests,
    getCreateRequests: () => createRequests,
    getBodies: () => bodies,
  };
}

describe('NotebooksListPage (integration)', () => {
  const originalPermissions = contextSrv.user.permissions;

  beforeEach(() => {
    setTestFlags({ [NOTEBOOKS_FLAG]: true });
    __resetSearchAvailabilityForTests();
    contextSrv.user.permissions = { [AccessControlAction.DashboardsCreate]: true };
  });

  afterEach(async () => {
    contextSrv.user.permissions = originalPermissions;
    await act(async () => {
      setTestFlags({});
    });
  });

  it('resolves author display names through the real iam client', async () => {
    setupNotebooksApi();

    render(<NotebooksListPage />);

    expect(await screen.findByText('Checkout error spike')).toBeInTheDocument();
    // Reconstructing `${type}:${name}` from the response would yield `user:u000000001`, miss the
    // `user:1` key we asked with, and fall back to Anonymous.
    expect(await screen.findByText('User 1')).toBeInTheDocument();
  });

  it('sends the search envelope the endpoint requires', async () => {
    const api = setupNotebooksApi();

    render(<NotebooksListPage />);

    expect(await screen.findByText('Checkout error spike')).toBeInTheDocument();

    // The server rejects a body without these (422) and rejects unknown fields (400), so this is
    // the wire contract rather than a preference.
    expect(api.getBodies()[0]).toEqual({
      apiVersion: 'search.grafana.app/v0alpha1',
      kind: 'SearchQuery',
      fields: ['title', 'tags', 'createdBy', 'created', 'updated'],
      limit: NOTEBOOKS_PAGE_LIMIT,
    });
  });

  // The whole point of the blank route: a click that somebody thinks better of should leave nothing
  // behind. This asserts against the real endpoint rather than a mocked hook, because "no notebook was
  // written" is a claim about the wire.
  it('writes no notebook when the create button is clicked', async () => {
    const api = setupNotebooksApi();

    const { user } = render(<NotebooksListPage />);

    expect(await screen.findByText('Checkout error spike')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'New notebook' }));

    await waitFor(() => {
      expect(locationService.getLocation().pathname).toBe('/notebooks/new');
    });
    expect(api.getCreateRequests()).toBe(0);
    // No new row either, so nothing was written that the list would have picked up.
    expect(screen.queryByRole('link', { name: 'New notebook' })).not.toBeInTheDocument();
  });

  // The endpoint pages with an opaque cursor, and the list is only honest once the walk finishes:
  // the table sorts what it holds, so stopping at page one would order a window, not the library.
  it('walks the continue token to the end and shows every page as one list', async () => {
    const pages = [
      { items: [hit('nb1', 'Page one notebook')], token: 'cursor-2' },
      { items: [hit('nb2', 'Page two notebook')], token: 'cursor-3' },
      { items: [hit('nb3', 'Page three notebook')], token: '' },
    ];
    const cursors: Array<string | undefined> = [];

    server.use(
      http.post(NOTEBOOKS_SEARCH_URL, async ({ request }) => {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- test-local shape
        const body = (await request.json()) as { continue?: string };
        cursors.push(body.continue);
        // Tokens are named for the page they lead to, so the cursor doubles as the index.
        const page = body.continue ? pages[Number(body.continue.replace('cursor-', '')) - 1] : pages[0];
        return HttpResponse.json({
          metadata: { totalHits: 3, totalHitsRelation: 'eq', continue: page.token },
          items: page.items,
        });
      })
    );

    render(<NotebooksListPage />);

    // All three rows, from three separate requests.
    expect(await screen.findByText('Page three notebook')).toBeInTheDocument();
    expect(screen.getByText('Page one notebook')).toBeInTheDocument();
    expect(screen.getByText('Page two notebook')).toBeInTheDocument();
    expect(screen.getByText('3 notebooks')).toBeInTheDocument();

    // The first request carries no cursor; each one after it carries the previous page's token.
    expect(cursors).toEqual([undefined, 'cursor-2', 'cursor-3']);
  });

  it('falls back to LIST where the search endpoint is not served', async () => {
    // What an apiserver without `enable_search_api` answers: the path parses as a request for a
    // resource named "search".
    server.use(
      http.post(NOTEBOOKS_SEARCH_URL, () =>
        HttpResponse.json({ kind: 'Status', status: 'Failure', code: 404, reason: 'NotFound' }, { status: 404 })
      ),
      http.get(NOTEBOOKS_URL, () =>
        HttpResponse.json({ metadata: {}, items: [notebook('nb1', 'Checkout error spike')] })
      )
    );

    render(<NotebooksListPage />);

    // The list renders anyway, and the 404 never reaches the user as an error.
    expect(await screen.findByText('Checkout error spike')).toBeInTheDocument();
    expect(screen.queryByText('Failed to load notebooks')).not.toBeInTheDocument();
  });
});
