import { HttpResponse, http } from 'msw';
import { render, screen, waitFor } from 'test/test-utils';

import { config } from '@grafana/runtime';
import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { ManagerKind } from 'app/features/apiserver/types';
import { setupProvisioningMswServer } from 'app/features/provisioning/mocks/server';

import { DashboardScene } from './DashboardScene';
import { ManagedDashboardNavBarBadge } from './ManagedDashboardNavBarBadge';

setupProvisioningMswServer();

/** Override the frontend settings endpoint that the badge's repository lookup reads from. */
function mockRepositories(repositories: Array<Partial<RepositoryView>>) {
  server.use(http.get(`${BASE}/settings`, () => HttpResponse.json({ items: repositories })));
}

function buildDashboard(kind?: ManagerKind, id?: string): DashboardScene {
  const dashboard = new DashboardScene({
    title: 'test dashboard',
    uid: 'dash-1',
  });

  jest.spyOn(dashboard, 'getManagerKind').mockReturnValue(kind);
  jest.spyOn(dashboard, 'getManagerIdentity').mockReturnValue(id);
  jest.spyOn(dashboard, 'getPath').mockReturnValue('dashboards/test.json');

  return dashboard;
}

describe('ManagedDashboardNavBarBadge', () => {
  let originalProvisioning: boolean | undefined;

  beforeEach(() => {
    originalProvisioning = config.featureToggles.provisioning;
    config.featureToggles.provisioning = true;
  });

  afterEach(() => {
    config.featureToggles.provisioning = originalProvisioning;
    jest.restoreAllMocks();
  });

  it('returns null when manager kind is missing', () => {
    const dashboard = buildDashboard(undefined, undefined);
    const { container } = render(<ManagedDashboardNavBarBadge dashboard={dashboard} />);

    expect(container.firstChild).toBeNull();
  });

  it('renders orphaned repository badge when the repository no longer exists', async () => {
    mockRepositories([]);

    const dashboard = buildDashboard(ManagerKind.Repo, 'repo-main');
    const { user } = render(<ManagedDashboardNavBarBadge dashboard={dashboard} />);

    const badgeIcon = await screen.findByTestId('icon-exclamation-triangle');
    await user.hover(badgeIcon);

    expect(await screen.findByText('Repository not found')).toBeInTheDocument();
  });

  it('renders managed repository tooltip with the repository title when repo exists', async () => {
    mockRepositories([{ name: 'repo-main', title: 'Main Repo', target: 'folder', type: 'github', workflows: [] }]);

    const dashboard = buildDashboard(ManagerKind.Repo, 'repo-main');
    const { user } = render(<ManagedDashboardNavBarBadge dashboard={dashboard} />);

    const badgeIcon = await screen.findByTestId('icon-exchange-alt');
    await user.hover(badgeIcon);

    await waitFor(async () => {
      expect(await screen.findByText('Managed by: Repository Main Repo')).toBeInTheDocument();
    });
  });

  it('renders a non-repository managed badge without repository lookup', async () => {
    const dashboard = buildDashboard(ManagerKind.Terraform, undefined);
    const { user } = render(<ManagedDashboardNavBarBadge dashboard={dashboard} />);

    await user.hover(screen.getByTestId('icon-exchange-alt'));
    expect(await screen.findByText('Managed by: Terraform')).toBeInTheDocument();
  });
});
