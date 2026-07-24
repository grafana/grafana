import { HttpResponse, http } from 'msw';
import { render, screen, waitFor } from 'test/test-utils';

import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { contextSrv } from 'app/core/services/context_srv';
import { ManagerKind } from 'app/features/apiserver/types';
import { AccessControlAction } from 'app/types/accessControl';

import { setupProvisioningMswServer } from '../mocks/server';

import { ManagedBadge } from './ManagedBadge';

setupProvisioningMswServer();

function makeRepository(overrides: Partial<RepositoryView> = {}): RepositoryView {
  return {
    name: 'my-repo',
    title: 'My Repo',
    target: 'folder',
    type: 'github',
    url: 'https://github.com/grafana/repo',
    branch: 'main',
    workflows: ['write'],
    ...overrides,
  };
}

/** Override the frontend settings endpoint that `useGetResourceRepositoryView` reads from. */
function mockRepositories(repositories: RepositoryView[]) {
  server.use(http.get(`${BASE}/settings`, () => HttpResponse.json({ items: repositories })));
}

// Spy created once per test in beforeEach; setPermissions only swaps its implementation.
let hasPermissionSpy: jest.SpyInstance;

function setPermissions({ isEditor = false, canManageRepositories = false } = {}) {
  contextSrv.isEditor = isEditor;
  hasPermissionSpy.mockImplementation(
    (action: string) => canManageRepositories && action === AccessControlAction.ProvisioningRepositoriesWrite
  );
}

describe('ManagedBadge', () => {
  let originalIsEditor: boolean;

  beforeEach(() => {
    originalIsEditor = contextSrv.isEditor;
    hasPermissionSpy = jest.spyOn(contextSrv, 'hasPermission');
    setPermissions();
  });

  afterEach(() => {
    contextSrv.isEditor = originalIsEditor;
    jest.restoreAllMocks();
  });

  describe('static badge', () => {
    it('renders the repository variant with the repository name in the tooltip', async () => {
      const { user } = render(<ManagedBadge managerKind={ManagerKind.Repo} name="My Repo" />);

      const badge = screen.getByTestId('icon-exchange-alt');
      await user.hover(badge);
      expect(await screen.findByText('Managed by: Repository My Repo')).toBeInTheDocument();
    });

    it('renders a generic repository tooltip when no name is provided', async () => {
      const { user } = render(<ManagedBadge managerKind={ManagerKind.Repo} />);

      await user.hover(screen.getByTestId('icon-exchange-alt'));
      expect(await screen.findByText('Managed by: Repository')).toBeInTheDocument();
    });

    it('renders the orphaned repository state', async () => {
      const { user } = render(<ManagedBadge managerKind={ManagerKind.Repo} isOrphaned />);

      const badge = screen.getByTestId('icon-exclamation-triangle');
      expect(badge).toBeInTheDocument();
      expect(screen.queryByTestId('icon-exchange-alt')).not.toBeInTheDocument();

      await user.hover(badge);
      expect(await screen.findByText('Repository not found')).toBeInTheDocument();
    });

    it.each([
      [ManagerKind.Terraform, 'Managed by: Terraform'],
      [ManagerKind.Kubectl, 'Managed by: Kubectl'],
      [ManagerKind.ClassicFP, 'Managed by: File provisioning'],
    ])('renders the %s variant', async (managerKind, expectedTooltip) => {
      const { user } = render(<ManagedBadge managerKind={managerKind} />);

      await user.hover(screen.getByTestId('icon-exchange-alt'));
      expect(await screen.findByText(expectedTooltip)).toBeInTheDocument();
    });

    it('renders the plugin variant including the plugin id', async () => {
      const { user } = render(<ManagedBadge managerKind={ManagerKind.Plugin} name="my-app" />);

      await user.hover(screen.getByTestId('icon-exchange-alt'));
      expect(await screen.findByText('Managed by: Plugin my-app')).toBeInTheDocument();
    });

    it('renders a generic "Provisioned" badge when the manager kind is omitted/unknown', async () => {
      const { user } = render(<ManagedBadge />);

      await user.hover(screen.getByTestId('icon-exchange-alt'));
      expect(await screen.findByText('Provisioned')).toBeInTheDocument();
    });
  });

  describe('actions dropdown', () => {
    it('renders a plain badge without a dropdown for users with no permitted action (viewer)', async () => {
      setPermissions({ isEditor: false, canManageRepositories: false });
      mockRepositories([makeRepository()]);

      render(<ManagedBadge managerKind={ManagerKind.Repo} repositoryName="my-repo" sourcePath="dashboards/foo.json" />);

      // Wait for the repository lookup to settle, then confirm no trigger appeared.
      await waitFor(() => expect(screen.getByTestId('icon-exchange-alt')).toBeInTheDocument());
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('shows only the source file link for editors without repository write access', async () => {
      setPermissions({ isEditor: true, canManageRepositories: false });
      mockRepositories([makeRepository()]);

      const { user } = render(
        <ManagedBadge managerKind={ManagerKind.Repo} repositoryName="my-repo" sourcePath="dashboards/foo.json" />
      );

      const trigger = await screen.findByRole('button', { name: 'Managed by: Repository My Repo' });
      await user.click(trigger);

      const sourceItem = await screen.findByRole('menuitem', { name: /view source file/i });
      expect(sourceItem).toHaveAttribute('href', 'https://github.com/grafana/repo/blob/main/dashboards/foo.json');
      expect(sourceItem).toHaveAttribute('target', '_blank');
      expect(screen.queryByRole('menuitem', { name: /manage repository/i })).not.toBeInTheDocument();
    });

    it('prefixes the repository path in the source file link when present', async () => {
      setPermissions({ isEditor: true });
      mockRepositories([makeRepository({ path: 'grafana' })]);

      const { user } = render(
        <ManagedBadge managerKind={ManagerKind.Repo} repositoryName="my-repo" sourcePath="dashboards/foo.json" />
      );

      await user.click(await screen.findByRole('button', { name: 'Managed by: Repository My Repo' }));

      expect(await screen.findByRole('menuitem', { name: /view source file/i })).toHaveAttribute(
        'href',
        'https://github.com/grafana/repo/blob/main/grafana/dashboards/foo.json'
      );
    });

    it('uses the ref from a source path fragment instead of the configured branch', async () => {
      setPermissions({ isEditor: true });
      mockRepositories([makeRepository()]);

      const { user } = render(
        <ManagedBadge
          managerKind={ManagerKind.Repo}
          repositoryName="my-repo"
          sourcePath="dashboards/foo.json#feature-branch"
        />
      );

      await user.click(await screen.findByRole('button', { name: 'Managed by: Repository My Repo' }));

      expect(await screen.findByRole('menuitem', { name: /view source file/i })).toHaveAttribute(
        'href',
        'https://github.com/grafana/repo/blob/feature-branch/dashboards/foo.json'
      );
    });

    it('does not set a title attribute on the dropdown trigger', async () => {
      setPermissions({ isEditor: true });
      mockRepositories([makeRepository()]);

      render(<ManagedBadge managerKind={ManagerKind.Repo} repositoryName="my-repo" sourcePath="dashboards/foo.json" />);

      const trigger = await screen.findByRole('button', { name: 'Managed by: Repository My Repo' });
      expect(trigger).not.toHaveAttribute('title');
    });

    it('shows the repository administration link for repository managers', async () => {
      setPermissions({ isEditor: false, canManageRepositories: true });
      mockRepositories([makeRepository()]);

      const { user } = render(
        <ManagedBadge managerKind={ManagerKind.Repo} repositoryName="my-repo" sourcePath="dashboards/foo.json" />
      );

      await user.click(await screen.findByRole('button', { name: 'Managed by: Repository My Repo' }));

      const manageItem = await screen.findByRole('menuitem', { name: /manage repository/i });
      expect(manageItem).toHaveAttribute('href', '/admin/provisioning/my-repo');
      expect(screen.queryByRole('menuitem', { name: /view source file/i })).not.toBeInTheDocument();
    });

    it('shows both actions for editors with repository write access', async () => {
      setPermissions({ isEditor: true, canManageRepositories: true });
      mockRepositories([makeRepository()]);

      const { user } = render(
        <ManagedBadge managerKind={ManagerKind.Repo} repositoryName="my-repo" sourcePath="dashboards/foo.json" />
      );

      await user.click(await screen.findByRole('button', { name: 'Managed by: Repository My Repo' }));

      expect(await screen.findByRole('menuitem', { name: /view source file/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /manage repository/i })).toBeInTheDocument();
    });

    it('omits the source file link for non-git providers but keeps repository administration', async () => {
      setPermissions({ isEditor: true, canManageRepositories: true });
      mockRepositories([makeRepository({ type: 'local', url: undefined, branch: undefined })]);

      const { user } = render(
        <ManagedBadge managerKind={ManagerKind.Repo} repositoryName="my-repo" sourcePath="dashboards/foo.json" />
      );

      await user.click(await screen.findByRole('button', { name: 'Managed by: Repository My Repo' }));

      expect(await screen.findByRole('menuitem', { name: /manage repository/i })).toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: /view source file/i })).not.toBeInTheDocument();
    });

    it('renders the orphaned badge without a dropdown when the repository no longer exists', async () => {
      setPermissions({ isEditor: true, canManageRepositories: true });
      mockRepositories([]);

      render(<ManagedBadge managerKind={ManagerKind.Repo} repositoryName="my-repo" sourcePath="dashboards/foo.json" />);

      await waitFor(() => expect(screen.getByTestId('icon-exclamation-triangle')).toBeInTheDocument());
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });
});
