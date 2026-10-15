import { render, screen } from 'test/test-utils';

import { type Repository, useGetRepositoryResourcesQuery } from 'app/api/clients/provisioning/v0alpha1';

import { BundlesView } from './BundlesView';

jest.mock('app/api/clients/provisioning/v0alpha1', () => ({
  ...jest.requireActual('app/api/clients/provisioning/v0alpha1'),
  useGetRepositoryResourcesQuery: jest.fn(),
}));

const mockUseGetRepositoryResourcesQuery = jest.mocked(useGetRepositoryResourcesQuery);

const repo: Repository = {
  metadata: { name: 'acme-repo' },
  spec: {
    title: 'ACME repository',
    type: 'github',
    github: { url: 'https://github.com/acme/sre-skills', branch: 'main' },
    sync: { target: 'folder', enabled: true },
    workflows: [],
  },
};

// The component reads only `data.items` and `isLoading`; the rest of the RTK query result is
// unused, so a partial mock is enough here.
function setupResources(items: unknown[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockUseGetRepositoryResourcesQuery.mockReturnValue({ data: { items }, isLoading: false } as any);
}

const bundle = {
  group: 'provisioning.grafana.app',
  resource: 'bundles',
  kind: 'Bundle',
  name: 'sample',
  title: 'sample',
  path: 'bundles/sample/bundle.json',
  hash: 'abc123',
  time: 1760000000000,
};

const dashboard = {
  group: 'dashboard.grafana.app',
  resource: 'dashboards',
  kind: 'Dashboard',
  name: 'fleet-overview',
  title: 'Fleet overview',
  path: 'dashboards/fleet.json',
  hash: 'def456',
};

describe('BundlesView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists only the repository resources that are bundles', async () => {
    setupResources([dashboard, bundle]);

    render(<BundlesView repo={repo} />);

    expect(await screen.findByText('sample')).toBeInTheDocument();
    expect(screen.queryByText('Fleet overview')).not.toBeInTheDocument();
  });

  it('links a bundle path to the file on the repository host', async () => {
    setupResources([bundle]);

    render(<BundlesView repo={repo} />);

    expect(await screen.findByRole('link', { name: 'bundles/sample/bundle.json' })).toHaveAttribute(
      'href',
      'https://github.com/acme/sre-skills/blob/main/bundles/sample/bundle.json'
    );
  });

  it('shows the bundle path as plain text when the repository has no host URL', async () => {
    setupResources([bundle]);

    render(<BundlesView repo={{ ...repo, spec: { ...repo.spec!, type: 'local', github: undefined } }} />);

    expect(await screen.findByText('bundles/sample/bundle.json')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'bundles/sample/bundle.json' })).not.toBeInTheDocument();
  });

  it('explains what a bundle is when the repository has none', async () => {
    setupResources([dashboard]);

    render(<BundlesView repo={repo} />);

    expect(await screen.findByText('No bundles in this repository')).toBeInTheDocument();
  });
});
