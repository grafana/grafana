import { HttpResponse, http } from 'msw';
import { render, screen, waitFor } from 'test/test-utils';

import { config } from '@grafana/runtime';
import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { contextSrv } from 'app/core/services/context_srv';
import { ManagerKind } from 'app/features/apiserver/types';
import { AccessControlAction } from 'app/types/accessControl';

import { setupProvisioningMswServer } from '../mocks/server';

import { ManagedResourceBadge } from './ManagedResourceBadge';

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

describe('ManagedResourceBadge', () => {
  let originalProvisioning: boolean;
  let originalIsEditor: boolean;

  beforeEach(() => {
    originalProvisioning = config.provisioningEnabled;
    originalIsEditor = contextSrv.isEditor;
    config.provisioningEnabled = true;
    hasPermissionSpy = jest.spyOn(contextSrv, 'hasPermission');
    setPermissions();
  });

  afterEach(() => {
    config.provisioningEnabled = originalProvisioning;
    contextSrv.isEditor = originalIsEditor;
    jest.restoreAllMocks();
  });

  describe('static badge', () => {
    it('renders the repository variant with the repository name in the tooltip', async () => {
      const { user } = render(<ManagedResourceBadge managerKind={ManagerKind.Repo} name="My Repo" />);

      const badge = screen.getByTestId('icon-exchange-alt');
      await user.hover(badge);
      expect(await screen.findByText('Managed by: Repository My Repo')).toBeInTheDocument();
    });

    it('renders a generic repository tooltip when no name is provided', async () => {
      const { user } = render(<ManagedResourceBadge managerKind={ManagerKind.Repo} />);

      await user.hover(screen.getByTestId('icon-exchange-alt'));
      expect(await screen.findByText('Managed by: Repository')).toBeInTheDocument();
    });

    it('renders the read-only variant with a labelled lock and says so in the tooltip', async () => {
      const { user } = render(<ManagedResourceBadge managerKind={ManagerKind.Repo} name="My Repo" isReadOnly />);

      expect(screen.queryByTestId('icon-exchange-alt')).not.toBeInTheDocument();
      expect(screen.getByRole('img', { name: 'Read only, Managed by: Repository My Repo' })).toBeInTheDocument();
      await user.hover(screen.getByTestId('icon-exchange-alt-lock'));
      expect(await screen.findByRole('tooltip')).toHaveTextContent('Read only, Managed by: Repository My Repo');
    });

    it('renders the orphaned repository state', async () => {
      const { user } = render(<ManagedResourceBadge managerKind={ManagerKind.Repo} isOrphaned />);

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
      const { user } = render(<ManagedResourceBadge managerKind={managerKind} />);

      await user.hover(screen.getByTestId('icon-exchange-alt'));
      expect(await screen.findByText(expectedTooltip)).toBeInTheDocument();
    });

    it('renders the plugin variant including the plugin id', async () => {
      const { user } = render(<ManagedResourceBadge managerKind={ManagerKind.Plugin} name="my-app" />);

      await user.hover(screen.getByTestId('icon-exchange-alt'));
      expect(await screen.findByText('Managed by: Plugin my-app')).toBeInTheDocument();
    });

    it('renders a generic "Provisioned" badge when the manager kind is omitted/unknown', async () => {
      const { user } = render(<ManagedResourceBadge />);

      await user.hover(screen.getByTestId('icon-exchange-alt'));
      expect(await screen.findByText('Provisioned')).toBeInTheDocument();
    });
  });

  describe('actions menu', () => {
    it('renders the badge without a menu button for users with no permitted action (viewer)', async () => {
      setPermissions({ isEditor: false, canManageRepositories: false });
      mockRepositories([makeRepository()]);

      render(
        <ManagedResourceBadge
          managerKind={ManagerKind.Repo}
          repositoryName="my-repo"
          sourcePath="dashboards/foo.json"
        />
      );

      // Wait for the repository lookup to settle, then confirm no trigger appeared.
      await waitFor(() => expect(screen.getByTestId('icon-exchange-alt')).toBeInTheDocument());
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('shows only the source file link for editors without repository write access', async () => {
      setPermissions({ isEditor: true, canManageRepositories: false });
      mockRepositories([makeRepository()]);

      const { user } = render(
        <ManagedResourceBadge
          managerKind={ManagerKind.Repo}
          repositoryName="my-repo"
          sourcePath="dashboards/foo.json"
        />
      );

      const trigger = await screen.findByRole('button', { name: 'Managed resource actions' });
      await user.click(trigger);

      const sourceItem = await screen.findByRole('menuitem', { name: /view source/i });
      expect(sourceItem).toHaveAttribute('href', 'https://github.com/grafana/repo/blob/main/dashboards/foo.json');
      expect(sourceItem).toHaveAttribute('target', '_blank');
      expect(screen.queryByRole('menuitem', { name: /manage repository/i })).not.toBeInTheDocument();
    });

    it('prefixes the repository path in the source file link when present', async () => {
      setPermissions({ isEditor: true });
      mockRepositories([makeRepository({ path: 'grafana' })]);

      const { user } = render(
        <ManagedResourceBadge
          managerKind={ManagerKind.Repo}
          repositoryName="my-repo"
          sourcePath="dashboards/foo.json"
        />
      );

      await user.click(await screen.findByRole('button', { name: 'Managed resource actions' }));

      expect(await screen.findByRole('menuitem', { name: /view source/i })).toHaveAttribute(
        'href',
        'https://github.com/grafana/repo/blob/main/grafana/dashboards/foo.json'
      );
    });

    it('uses the ref from a source path fragment instead of the configured branch', async () => {
      setPermissions({ isEditor: true });
      mockRepositories([makeRepository()]);

      const { user } = render(
        <ManagedResourceBadge
          managerKind={ManagerKind.Repo}
          repositoryName="my-repo"
          sourcePath="dashboards/foo.json#feature-branch"
        />
      );

      await user.click(await screen.findByRole('button', { name: 'Managed resource actions' }));

      expect(await screen.findByRole('menuitem', { name: /view source/i })).toHaveAttribute(
        'href',
        'https://github.com/grafana/repo/blob/feature-branch/dashboards/foo.json'
      );
    });

    it('marks the menu button as a menu trigger without a title attribute', async () => {
      setPermissions({ isEditor: true });
      mockRepositories([makeRepository()]);

      render(
        <ManagedResourceBadge
          managerKind={ManagerKind.Repo}
          repositoryName="my-repo"
          sourcePath="dashboards/foo.json"
        />
      );

      const trigger = await screen.findByRole('button', { name: 'Managed resource actions' });
      expect(trigger).not.toHaveAttribute('title');
      expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    });

    it('shows the repository administration link for repository managers', async () => {
      setPermissions({ isEditor: false, canManageRepositories: true });
      mockRepositories([makeRepository()]);

      const { user } = render(
        <ManagedResourceBadge
          managerKind={ManagerKind.Repo}
          repositoryName="my-repo"
          sourcePath="dashboards/foo.json"
        />
      );

      await user.click(await screen.findByRole('button', { name: 'Managed resource actions' }));

      const manageItem = await screen.findByRole('menuitem', { name: /manage repository/i });
      expect(manageItem).toHaveAttribute('href', '/admin/provisioning/my-repo');
      expect(screen.queryByRole('menuitem', { name: /view source/i })).not.toBeInTheDocument();
    });

    it('shows both actions for editors with repository write access', async () => {
      setPermissions({ isEditor: true, canManageRepositories: true });
      mockRepositories([makeRepository()]);

      const { user } = render(
        <ManagedResourceBadge
          managerKind={ManagerKind.Repo}
          repositoryName="my-repo"
          sourcePath="dashboards/foo.json"
        />
      );

      await user.click(await screen.findByRole('button', { name: 'Managed resource actions' }));

      expect(await screen.findByRole('menuitem', { name: /view source/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /manage repository/i })).toBeInTheDocument();
    });

    it('omits the source file link for non-git providers but keeps repository administration', async () => {
      setPermissions({ isEditor: true, canManageRepositories: true });
      mockRepositories([makeRepository({ type: 'local', url: undefined, branch: undefined })]);

      const { user } = render(
        <ManagedResourceBadge
          managerKind={ManagerKind.Repo}
          repositoryName="my-repo"
          sourcePath="dashboards/foo.json"
        />
      );

      await user.click(await screen.findByRole('button', { name: 'Managed resource actions' }));

      expect(await screen.findByRole('menuitem', { name: /manage repository/i })).toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: /view source/i })).not.toBeInTheDocument();
    });

    it('renders the orphaned badge without a menu button when the repository no longer exists', async () => {
      setPermissions({ isEditor: true, canManageRepositories: true });
      mockRepositories([]);

      render(
        <ManagedResourceBadge
          managerKind={ManagerKind.Repo}
          repositoryName="my-repo"
          sourcePath="dashboards/foo.json"
        />
      );

      await waitFor(() => expect(screen.getByTestId('icon-exclamation-triangle')).toBeInTheDocument());
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('renders a plain badge when the provisioning feature toggle is off', () => {
      setPermissions({ isEditor: true, canManageRepositories: true });
      config.provisioningEnabled = false;

      render(
        <ManagedResourceBadge
          managerKind={ManagerKind.Repo}
          repositoryName="my-repo"
          sourcePath="dashboards/foo.json"
        />
      );

      expect(screen.getByTestId('icon-exchange-alt')).toBeInTheDocument();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });
});
