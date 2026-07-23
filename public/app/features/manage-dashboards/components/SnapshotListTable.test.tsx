import { http, HttpResponse } from 'msw';
import { render, screen, waitFor } from 'test/test-utils';

import { config, setBackendSrv } from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';
import { configureStore } from 'app/store/configureStore';

import { getSnapshots, SnapshotListTable } from './SnapshotListTable';

jest.mock('app/core/services/context_srv');
const mockContextSrv = jest.mocked(contextSrv);

// Use the real backendSrv so RTK Query's base query issues real HTTP requests that
// msw intercepts — this exercises the integration with RTK Query rather than mocking
// its internal base-query behavior.
setBackendSrv(backendSrv);
setupMockServer();

const LEGACY_URL = '/api/dashboard/snapshots';
const K8S_LIST_URL = '/apis/dashboard.grafana.app/v0alpha1/namespaces/:namespace/snapshots';
const K8S_ITEM_URL = '/apis/dashboard.grafana.app/v0alpha1/namespaces/:namespace/snapshots/:name';

const legacyResponse = [
  {
    name: 'Snap 1',
    key: 'JRXqfKihKZek70FM6Xaq502NxH7OyyEs',
    external: true,
    externalUrl: 'https://www.externalSnapshotUrl.com',
  },
  {
    id: 3,
    name: 'Snap 2',
    key: 'RziRfhlBDTjwyYGoHAjnWyrMNQ1zUg3j',
    external: false,
    externalUrl: '',
  },
];

const k8sFirstPage = {
  items: [
    {
      metadata: { name: 'k8s-snap-1', namespace: 'default', resourceVersion: '1', creationTimestamp: '' },
      spec: { title: 'K8s Snap 1', external: false },
    },
    {
      metadata: { name: 'k8s-snap-2', namespace: 'default', resourceVersion: '1', creationTimestamp: '' },
      spec: { title: 'K8s Snap 2', external: false },
    },
  ],
  metadata: { continue: 'tok-page-2', resourceVersion: '1' },
};

const k8sSecondPage = {
  items: [
    {
      metadata: { name: 'k8s-snap-3', namespace: 'default', resourceVersion: '1', creationTimestamp: '' },
      spec: { title: 'K8s Snap 3', external: false },
    },
  ],
  metadata: { resourceVersion: '1' },
};

// Serves the k8s snapshot list, choosing the page from the `continue` query param, and
// records the tokens it was called with so tests can assert pagination wiring.
function mockK8sList(firstPage: object, nextPage?: object) {
  const continueTokens: Array<string | null> = [];
  server.use(
    http.get(K8S_LIST_URL, ({ request }) => {
      const token = new URL(request.url).searchParams.get('continue');
      continueTokens.push(token);
      return HttpResponse.json(token ? nextPage : firstPage);
    })
  );
  return continueTokens;
}

function mockK8sDelete() {
  server.use(http.delete(K8S_ITEM_URL, () => HttpResponse.json({})));
}

describe('getSnapshots', () => {
  beforeEach(() => {
    // K8sAPI.getSnapshots dispatches RTK Query through the global store; configureStore
    // registers the dashboard client and wires it as the global store.
    configureStore();
    config.appUrl = 'http://snapshots.grafana.com/';
    config.featureToggles.kubernetesSnapshots = false;
  });

  test('returns paginated shape with decorated urls (legacy)', async () => {
    server.use(http.get(LEGACY_URL, () => HttpResponse.json(legacyResponse)));

    const result = await getSnapshots();

    expect(result.continueToken).toBeUndefined();
    expect(result.items).toMatchInlineSnapshot(`
      [
        {
          "external": true,
          "externalUrl": "https://www.externalSnapshotUrl.com",
          "key": "JRXqfKihKZek70FM6Xaq502NxH7OyyEs",
          "name": "Snap 1",
          "url": "http://snapshots.grafana.com/dashboard/snapshot/JRXqfKihKZek70FM6Xaq502NxH7OyyEs",
        },
        {
          "external": false,
          "externalUrl": "",
          "id": 3,
          "key": "RziRfhlBDTjwyYGoHAjnWyrMNQ1zUg3j",
          "name": "Snap 2",
          "url": "http://snapshots.grafana.com/dashboard/snapshot/RziRfhlBDTjwyYGoHAjnWyrMNQ1zUg3j",
        },
      ]
    `);
  });

  test('propagates the k8s continue token', async () => {
    config.featureToggles.kubernetesSnapshots = true;
    const continueTokens = mockK8sList(k8sFirstPage, k8sSecondPage);

    const result = await getSnapshots();

    expect(result.continueToken).toBe('tok-page-2');
    expect(result.items).toHaveLength(2);
    expect(continueTokens).toEqual([null]);
  });

  test('forwards the continue option to the k8s api', async () => {
    config.featureToggles.kubernetesSnapshots = true;
    const continueTokens = mockK8sList(k8sFirstPage, k8sSecondPage);

    await getSnapshots({ continue: 'tok-page-2' });

    expect(continueTokens).toEqual(['tok-page-2']);
  });
});

describe('SnapshotListTable', () => {
  beforeEach(() => {
    config.appUrl = 'http://snapshots.grafana.com/';
    config.featureToggles.kubernetesSnapshots = false;
    mockContextSrv.hasPermission.mockReturnValue(true);
    mockContextSrv.hasPermissionInMetadata.mockReturnValue(true);
  });

  test('does not render Load More on the legacy path', async () => {
    server.use(http.get(LEGACY_URL, () => HttpResponse.json(legacyResponse)));

    render(<SnapshotListTable />);

    await waitFor(() => expect(screen.getByText('Snap 1')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Show more snapshots' })).not.toBeInTheDocument();
  });

  test('renders Load More when k8s returns a continue token and appends the next page on click', async () => {
    config.featureToggles.kubernetesSnapshots = true;
    const continueTokens = mockK8sList(k8sFirstPage, k8sSecondPage);

    const { user } = render(<SnapshotListTable />);

    await waitFor(() => expect(screen.getByText('K8s Snap 1')).toBeInTheDocument());
    expect(screen.getByText('K8s Snap 2')).toBeInTheDocument();

    const button = screen.getByRole('button', { name: 'Show more snapshots' });

    await user.click(button);

    await waitFor(() => expect(screen.getByText('K8s Snap 3')).toBeInTheDocument());
    // first two rows remain visible
    expect(screen.getByText('K8s Snap 1')).toBeInTheDocument();
    expect(screen.getByText('K8s Snap 2')).toBeInTheDocument();
    // continue token is gone so button is no longer rendered
    expect(screen.queryByRole('button', { name: 'Show more snapshots' })).not.toBeInTheDocument();
    // second fetch carried the continue token from the first page
    expect(continueTokens).toEqual([null, 'tok-page-2']);
  });

  test('keeps Load More reachable when deleting the only loaded row leaves a continue token', async () => {
    config.featureToggles.kubernetesSnapshots = true;
    const singleItemFirstPage = {
      items: [
        {
          metadata: { name: 'only-snap', namespace: 'default', resourceVersion: '1', creationTimestamp: '' },
          spec: { title: 'Only Snap', external: false },
        },
      ],
      metadata: { continue: 'tok-page-2', resourceVersion: '1' },
    };
    mockK8sList(singleItemFirstPage, k8sSecondPage);
    mockK8sDelete();

    const { user } = render(<SnapshotListTable />);

    await waitFor(() => expect(screen.getByText('Only Snap')).toBeInTheDocument());

    // Delete the only visible row
    await user.click(screen.getByRole('button', { name: '' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(screen.queryByText('Only Snap')).not.toBeInTheDocument());

    // Empty state must not take over while a continue token is outstanding
    expect(screen.queryByText("You haven't created any snapshots yet")).not.toBeInTheDocument();
    const loadMore = screen.getByRole('button', { name: 'Show more snapshots' });

    await user.click(loadMore);
    await waitFor(() => expect(screen.getByText('K8s Snap 3')).toBeInTheDocument());
  });

  test('renders the empty state only after the first fetch resolves', async () => {
    config.featureToggles.kubernetesSnapshots = true;
    mockK8sList({ items: [], metadata: { resourceVersion: '1' } });

    render(<SnapshotListTable />);

    // no empty-state message before resolution
    expect(screen.queryByText("You haven't created any snapshots yet")).not.toBeInTheDocument();

    await waitFor(() => expect(screen.getByText("You haven't created any snapshots yet")).toBeInTheDocument());
  });

  test('shows a Retry button when the initial fetch fails and recovers on click', async () => {
    config.featureToggles.kubernetesSnapshots = true;
    let attempts = 0;
    server.use(
      http.get(K8S_LIST_URL, () => {
        attempts += 1;
        if (attempts === 1) {
          return HttpResponse.json({ message: 'boom' }, { status: 500 });
        }
        return HttpResponse.json(k8sFirstPage);
      })
    );

    const { user } = render(<SnapshotListTable />);

    await waitFor(() => expect(screen.getByText('Failed to load snapshots')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(screen.getByText('K8s Snap 1')).toBeInTheDocument());
    expect(screen.getByText('K8s Snap 2')).toBeInTheDocument();
    // error UI must be gone after a successful retry
    expect(screen.queryByText('Failed to load snapshots')).not.toBeInTheDocument();
  });
});
