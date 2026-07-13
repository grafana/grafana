import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { render, screen, waitFor } from 'test/test-utils';

import { config, reportInteraction } from '@grafana/runtime';
import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { contextSrv } from 'app/core/services/context_srv';
import { ManagerKind } from 'app/features/apiserver/types';
import { AccessControlAction } from 'app/types/accessControl';

import { setupProvisioningMswServer } from '../mocks/server';

import { ManagedBadge } from './ManagedBadge';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

setupProvisioningMswServer();

function makeRepository(overrides: Partial<RepositoryView>): RepositoryView {
  return {
    name: 'my-repo',
    title: 'My repo',
    target: 'folder',
    type: 'github',
    workflows: ['write'],
    ...overrides,
  };
}

function mockRepositories(repositories: RepositoryView[]) {
  server.use(http.get(`${BASE}/settings`, () => HttpResponse.json({ items: repositories })));
}

describe('ManagedBadge', () => {
  describe('badge variants', () => {
    it('renders the repository variant with the repository name in the tooltip', async () => {
      const user = userEvent.setup();
      render(<ManagedBadge managerKind={ManagerKind.Repo} name="My Repo" />);

      const badge = screen.getByTestId('icon-exchange-alt');
      await user.hover(badge);
      expect(await screen.findByText('Managed by: Repository My Repo')).toBeInTheDocument();
    });

    it('renders a generic repository tooltip when no name is provided', async () => {
      const user = userEvent.setup();
      render(<ManagedBadge managerKind={ManagerKind.Repo} />);

      await user.hover(screen.getByTestId('icon-exchange-alt'));
      expect(await screen.findByText('Managed by: Repository')).toBeInTheDocument();
    });

    it('renders the orphaned repository state', async () => {
      const user = userEvent.setup();
      render(<ManagedBadge managerKind={ManagerKind.Repo} isOrphaned />);

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
      const user = userEvent.setup();
      render(<ManagedBadge managerKind={managerKind} />);

      await user.hover(screen.getByTestId('icon-exchange-alt'));
      expect(await screen.findByText(expectedTooltip)).toBeInTheDocument();
    });

    it('renders the plugin variant including the plugin id', async () => {
      const user = userEvent.setup();
      render(<ManagedBadge managerKind={ManagerKind.Plugin} name="my-app" />);

      await user.hover(screen.getByTestId('icon-exchange-alt'));
      expect(await screen.findByText('Managed by: Plugin my-app')).toBeInTheDocument();
    });

    it('renders a generic "Provisioned" badge when the manager kind is omitted/unknown', async () => {
      const user = userEvent.setup();
      render(<ManagedBadge />);

      await user.hover(screen.getByTestId('icon-exchange-alt'));
      expect(await screen.findByText('Provisioned')).toBeInTheDocument();
    });
  });

  describe('repository links on hover', () => {
    let originalProvisioning: boolean | undefined;

    beforeEach(() => {
      originalProvisioning = config.featureToggles.provisioning;
      config.featureToggles.provisioning = true;
      jest.mocked(reportInteraction).mockClear();
    });

    afterEach(() => {
      config.featureToggles.provisioning = originalProvisioning;
      jest.restoreAllMocks();
    });

    it('reveals the source-file link on hover for repository-managed resources with a source path', async () => {
      const user = userEvent.setup();
      mockRepositories([makeRepository({ type: 'github', url: 'https://github.com/grafana/repo', branch: 'main' })]);

      render(
        <ManagedBadge managerKind={ManagerKind.Repo} name="My repo" repositoryName="my-repo" sourcePath="foo.json" />
      );

      await user.hover(screen.getByTestId('icon-exchange-alt'));

      const link = await screen.findByRole('link', { name: /view source/i });
      expect(link).toHaveAttribute('href', 'https://github.com/grafana/repo/blob/main/foo.json');
    });

    it('reveals the repository link on hover for users with the repository read permission (managers)', async () => {
      jest
        .spyOn(contextSrv, 'hasPermission')
        .mockImplementation((action: string) => action === AccessControlAction.ProvisioningRepositoriesRead);
      const user = userEvent.setup();
      mockRepositories([makeRepository({})]);

      render(<ManagedBadge managerKind={ManagerKind.Repo} name="My repo" repositoryName="my-repo" />);

      await user.hover(screen.getByTestId('icon-exchange-alt'));

      const link = await screen.findByRole('link', { name: 'View repository' });
      expect(link).toHaveAttribute('href', '/admin/provisioning/my-repo');
    });

    it('hides the repository link for users without the permission (editors see only the source link)', async () => {
      jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
      const user = userEvent.setup();
      mockRepositories([makeRepository({ type: 'github', url: 'https://github.com/grafana/repo', branch: 'main' })]);

      render(
        <ManagedBadge managerKind={ManagerKind.Repo} name="My repo" repositoryName="my-repo" sourcePath="foo.json" />
      );

      await user.hover(screen.getByTestId('icon-exchange-alt'));

      expect(await screen.findByRole('link', { name: /view source/i })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'View repository' })).not.toBeInTheDocument();
    });

    it('does not reveal links for orphaned repositories', async () => {
      jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
      const user = userEvent.setup();

      render(<ManagedBadge managerKind={ManagerKind.Repo} repositoryName="my-repo" isOrphaned />);

      await user.hover(screen.getByTestId('icon-exclamation-triangle'));
      await screen.findByText('Repository not found');
      expect(screen.queryByRole('link', { name: 'View repository' })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /source/i })).not.toBeInTheDocument();
    });

    it('does not request the source file when no source path is provided', async () => {
      let settingsRequested = false;
      server.use(
        http.get(`${BASE}/settings`, () => {
          settingsRequested = true;
          return HttpResponse.json({ items: [] });
        })
      );
      jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
      const user = userEvent.setup();

      render(<ManagedBadge managerKind={ManagerKind.Repo} name="My repo" repositoryName="my-repo" />);

      await user.hover(screen.getByTestId('icon-exchange-alt'));
      // The managed-by text still shows, but with no source path SourceLink never mounts, so no
      // settings query is made.
      expect(await screen.findByText('Managed by: Repository My repo')).toBeInTheDocument();
      await waitFor(() => expect(screen.queryByRole('link', { name: /source/i })).not.toBeInTheDocument());
      expect(settingsRequested).toBe(false);
    });

    it('reports a hover interaction when the badge is hovered', async () => {
      const user = userEvent.setup();
      mockRepositories([makeRepository({})]);

      render(<ManagedBadge managerKind={ManagerKind.Repo} name="My repo" repositoryName="my-repo" />);

      await user.hover(screen.getByTestId('icon-exchange-alt'));

      expect(reportInteraction).toHaveBeenCalledWith('grafana_provisioning_managed_badge_hovered', {
        managerKind: ManagerKind.Repo,
      });
    });
  });
});
