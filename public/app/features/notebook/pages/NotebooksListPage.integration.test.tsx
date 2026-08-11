import { HttpResponse, http } from 'msw';
import { render, screen, waitFor, act } from 'test/test-utils';

import { setBackendSrv } from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { NotebooksListPage } from './NotebooksListPage';

// Deliberately no jest.mock of the api-client modules here: the point of this suite is to exercise
// the real RTK Query wiring, including the claim that creating a notebook invalidates the
// 'Notebook' tag and refetches the list. The mocked suite next door covers the rendering cases.

const NOTEBOOKS_FLAG = 'dashboard.notebooks';
const NOTEBOOKS_URL = '/apis/dashboard.grafana.app/v2beta1/namespaces/:namespace/notebooks';

// The api clients issue their requests through the backend service, which msw then intercepts.
setBackendSrv(backendSrv);
setupMockServer();

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

/** Serves a list that grows once the create endpoint is hit, and counts list requests. */
function setupNotebooksApi() {
  const items = [notebook('nb1', 'Checkout error spike')];
  let listRequests = 0;

  server.use(
    http.get(NOTEBOOKS_URL, () => {
      listRequests++;
      return HttpResponse.json({ metadata: {}, items });
    }),
    http.post(NOTEBOOKS_URL, async () => {
      const created = notebook('nb2', 'New notebook');
      items.push(created);
      return HttpResponse.json(created);
    })
  );

  return { getListRequests: () => listRequests };
}

describe('NotebooksListPage (integration)', () => {
  const originalPermissions = contextSrv.user.permissions;

  beforeEach(() => {
    setTestFlags({ [NOTEBOOKS_FLAG]: true });
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

  it('refetches the list after creating a notebook', async () => {
    const api = setupNotebooksApi();

    const { user } = render(<NotebooksListPage />);

    expect(await screen.findByText('Checkout error spike')).toBeInTheDocument();
    const listRequestsBefore = api.getListRequests();

    await user.click(screen.getByRole('button', { name: 'New notebook' }));

    // The create mutation invalidates the 'Notebook' tag, so the list query reruns and the new
    // row shows up without the page asking for it.
    await waitFor(() => {
      expect(api.getListRequests()).toBeGreaterThan(listRequestsBefore);
    });
    expect(await screen.findByRole('link', { name: 'New notebook' })).toBeInTheDocument();
  });
});
