import { HttpResponse, http } from 'msw';
import { render, screen, waitFor } from 'test/test-utils';

import { config } from '@grafana/runtime';
import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import {
  AnnoKeyManagerAllowsEdits,
  AnnoKeyManagerIdentity,
  AnnoKeyManagerKind,
  AnnoKeySourcePath,
  ManagerKind,
} from 'app/features/apiserver/types';
import { setupProvisioningMswServer } from 'app/features/provisioning/mocks/server';

import { DashboardScene } from './DashboardScene';
import { ManagedDashboardNavBarBadge } from './ManagedDashboardNavBarBadge';

setupProvisioningMswServer();

/** Override the frontend settings endpoint that the badge's repository lookup reads from. */
function mockRepositories(repositories: Array<Partial<RepositoryView>>) {
  server.use(http.get(`${BASE}/settings`, () => HttpResponse.json({ items: repositories })));
}

interface DashboardOptions {
  kind?: ManagerKind;
  id?: string;
  canEdit?: boolean;
  managerAllowsEdits?: boolean;
}

function buildDashboard({ kind, id, canEdit = false, managerAllowsEdits = false }: DashboardOptions): DashboardScene {
  const annotations: Record<string, string> = { [AnnoKeySourcePath]: 'dashboards/test.json' };
  if (kind) {
    annotations[AnnoKeyManagerKind] = kind;
  }
  if (id) {
    annotations[AnnoKeyManagerIdentity] = id;
  }
  if (managerAllowsEdits) {
    annotations[AnnoKeyManagerAllowsEdits] = 'true';
  }

  return new DashboardScene({
    title: 'test dashboard',
    uid: 'dash-1',
    meta: { canEdit, k8s: { annotations } },
  });
}

const readOnlyRepo: Partial<RepositoryView> = {
  name: 'repo-main',
  title: 'Main Repo',
  target: 'folder',
  type: 'github',
  workflows: [],
};

describe('ManagedDashboardNavBarBadge', () => {
  let originalProvisioning: boolean;

  beforeEach(() => {
    originalProvisioning = config.provisioningEnabled;
    config.provisioningEnabled = true;
  });

  afterEach(() => {
    config.provisioningEnabled = originalProvisioning;
  });

  it('returns null when manager kind is missing', () => {
    const dashboard = buildDashboard({});
    const { container } = render(<ManagedDashboardNavBarBadge dashboard={dashboard} />);

    expect(container.firstChild).toBeNull();
  });

  it('renders orphaned repository badge when the repository no longer exists', async () => {
    mockRepositories([]);

    const dashboard = buildDashboard({ kind: ManagerKind.Repo, id: 'repo-main' });
    const { user } = render(<ManagedDashboardNavBarBadge dashboard={dashboard} />);

    const badgeIcon = await screen.findByTestId('icon-exclamation-triangle');
    await user.hover(badgeIcon);

    expect(await screen.findByText('Repository not found')).toBeInTheDocument();
  });

  it('renders managed repository tooltip with the repository title when repo exists', async () => {
    mockRepositories([{ ...readOnlyRepo, workflows: ['write'] }]);

    const dashboard = buildDashboard({ kind: ManagerKind.Repo, id: 'repo-main' });
    const { user } = render(<ManagedDashboardNavBarBadge dashboard={dashboard} />);

    const badgeIcon = await screen.findByTestId('icon-exchange-alt');
    await user.hover(badgeIcon);

    await waitFor(async () => {
      expect(await screen.findByText('Managed by: Repository Main Repo')).toBeInTheDocument();
    });
  });

  it('renders a non-repository managed badge without repository lookup', async () => {
    const dashboard = buildDashboard({ kind: ManagerKind.Terraform, managerAllowsEdits: true });
    const { user } = render(<ManagedDashboardNavBarBadge dashboard={dashboard} />);

    await user.hover(screen.getByTestId('icon-exchange-alt'));
    expect(await screen.findByText('Managed by: Terraform')).toBeInTheDocument();
  });

  it('locks the badge on a read-only repository for a user who could otherwise edit', async () => {
    mockRepositories([readOnlyRepo]);

    const dashboard = buildDashboard({ kind: ManagerKind.Repo, id: 'repo-main', canEdit: true });
    const { user } = render(<ManagedDashboardNavBarBadge dashboard={dashboard} />);

    await user.hover(await screen.findByTestId('icon-exchange-alt-lock'));

    expect(await screen.findByText('Read only, Managed by: Repository Main Repo')).toBeInTheDocument();
  });

  it('leaves the badge unlocked for a user who cannot edit the dashboard anyway', async () => {
    mockRepositories([readOnlyRepo]);

    const dashboard = buildDashboard({ kind: ManagerKind.Repo, id: 'repo-main' });
    const { user } = render(<ManagedDashboardNavBarBadge dashboard={dashboard} />);

    // The unlocked badge renders while the repository settings are in flight, so wait for the
    // fetched title before reading anything into the missing lock.
    await user.hover(await screen.findByTestId('icon-exchange-alt'));

    expect(await screen.findByText('Managed by: Repository Main Repo')).toBeInTheDocument();
    expect(screen.queryByTestId('icon-exchange-alt-lock')).not.toBeInTheDocument();
  });

  it('locks the badge when a non-repository manager does not allow edits', async () => {
    const dashboard = buildDashboard({ kind: ManagerKind.Terraform, canEdit: true });
    const { user } = render(<ManagedDashboardNavBarBadge dashboard={dashboard} />);

    await user.hover(screen.getByTestId('icon-exchange-alt-lock'));

    expect(await screen.findByText('Read only, Managed by: Terraform')).toBeInTheDocument();
  });
});
