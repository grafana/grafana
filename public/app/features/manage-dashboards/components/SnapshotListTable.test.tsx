import { render, screen, waitFor } from 'test/test-utils';

import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';

import { getSnapshots, SnapshotListTable } from './SnapshotListTable';

jest.mock('app/core/services/context_srv');
const mockContextSrv = jest.mocked(contextSrv);

const k8sUrl = '/apis/dashboard.grafana.app/v0alpha1/namespaces/default/snapshots';

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

const get = jest.fn();
const del = jest.fn();

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => ({
    get: (...args: unknown[]) => get(...args),
    delete: (...args: unknown[]) => del(...args),
  }),
}));

jest.mock('../../../api/utils', () => ({
  getAPINamespace: () => 'default',
}));

describe('getSnapshots', () => {
  beforeEach(() => {
    config.appUrl = 'http://snapshots.grafana.com/';
    config.featureToggles.kubernetesSnapshots = false;
    get.mockReset();
  });

  test('returns paginated shape with decorated urls (legacy)', async () => {
    get.mockResolvedValueOnce(legacyResponse);

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
    get.mockResolvedValueOnce(k8sFirstPage);

    const result = await getSnapshots();

    expect(result.continueToken).toBe('tok-page-2');
    expect(result.items).toHaveLength(2);
    expect(get).toHaveBeenCalledWith(k8sUrl, { continue: undefined });
  });

  test('forwards the continue option to the k8s api', async () => {
    config.featureToggles.kubernetesSnapshots = true;
    get.mockResolvedValueOnce(k8sSecondPage);

    await getSnapshots({ continue: 'tok-page-2' });

    expect(get).toHaveBeenCalledWith(k8sUrl, { continue: 'tok-page-2' });
  });
});

describe('SnapshotListTable', () => {
  beforeEach(() => {
    config.appUrl = 'http://snapshots.grafana.com/';
    config.featureToggles.kubernetesSnapshots = false;
    get.mockReset();
    del.mockReset().mockResolvedValue(undefined);
    mockContextSrv.hasPermission.mockReturnValue(true);
    mockContextSrv.hasPermissionInMetadata.mockReturnValue(true);
  });

  test('does not render Load More on the legacy path', async () => {
    get.mockResolvedValueOnce(legacyResponse);

    render(<SnapshotListTable />);

    await waitFor(() => expect(screen.getByText('Snap 1')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Show more snapshots' })).not.toBeInTheDocument();
  });

  test('renders Load More when k8s returns a continue token and appends the next page on click', async () => {
    config.featureToggles.kubernetesSnapshots = true;
    get.mockResolvedValueOnce(k8sFirstPage).mockResolvedValueOnce(k8sSecondPage);

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
    expect(get).toHaveBeenNthCalledWith(2, k8sUrl, { continue: 'tok-page-2' });
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
    get.mockResolvedValueOnce(singleItemFirstPage).mockResolvedValueOnce(k8sSecondPage);

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
    get.mockResolvedValueOnce({ items: [], metadata: { resourceVersion: '1' } });

    render(<SnapshotListTable />);

    // no empty-state message before resolution
    expect(screen.queryByText("You haven't created any snapshots yet")).not.toBeInTheDocument();

    await waitFor(() => expect(screen.getByText("You haven't created any snapshots yet")).toBeInTheDocument());
  });
});
