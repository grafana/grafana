import saveAs from 'file-saver';
import { render, screen } from 'test/test-utils';

import { type Repository } from 'app/api/clients/provisioning/v0alpha1';
import {
  AnnoKeyManagerAllowsEdits,
  AnnoKeyManagerIdentity,
  AnnoKeyManagerKind,
  ManagerKind,
} from 'app/features/apiserver/types';

import { setupProvisioningMswServer } from '../mocks/server';

import { RepositoryListItem } from './RepositoryListItem';

jest.mock('file-saver', () => jest.fn());

setupProvisioningMswServer();

const createMockRepository = (overrides: Partial<Repository> = {}): Repository => ({
  metadata: { name: 'test-repo' },
  spec: {
    title: 'Test Repository',
    type: 'github',
    sync: { target: 'folder', enabled: true },
    workflows: [],
    github: {
      url: 'https://github.com/owner/repo',
      branch: 'main',
    },
  },
  status: {
    health: { healthy: true, checked: Date.now() },
    sync: { state: 'success', message: [] },
    observedGeneration: 1,
    webhook: {},
  },
  ...overrides,
});

describe('RepositoryListItem', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('repository URL display', () => {
    it('should display repository URL for GitHub repos', () => {
      render(<RepositoryListItem repository={createMockRepository()} />);

      const link = screen.getByRole('link', { name: /owner\/repo/ });
      expect(link).toHaveAttribute('href', expect.stringContaining('github.com/owner/repo'));
    });

    it('should display repository URL for GitLab repos', () => {
      const repo = createMockRepository({
        spec: {
          title: 'GitLab Repo',
          type: 'gitlab',
          gitlab: { url: 'https://gitlab.com/group/project', branch: 'main' },
          sync: { target: 'folder', enabled: true },
          workflows: [],
        },
      });
      render(<RepositoryListItem repository={repo} />);

      const link = screen.getByRole('link', { name: /group\/project/ });
      expect(link).toHaveAttribute('href', expect.stringContaining('gitlab.com/group/project'));
    });

    it('should display repository URL for Bitbucket repos', () => {
      const repo = createMockRepository({
        spec: {
          title: 'Bitbucket Repo',
          type: 'bitbucket',
          bitbucket: { url: 'https://bitbucket.org/workspace/repo', branch: 'main' },
          sync: { target: 'folder', enabled: true },
          workflows: [],
        },
      });
      render(<RepositoryListItem repository={repo} />);

      const link = screen.getByRole('link', { name: /workspace\/repo/ });
      expect(link).toHaveAttribute('href', expect.stringContaining('bitbucket.org/workspace/repo'));
    });

    it('should display repository URL for generic git repos', () => {
      const repo = createMockRepository({
        spec: {
          title: 'Git Repo',
          type: 'git',
          git: { url: 'https://git.example.com/owner/repo', branch: 'main' },
          sync: { target: 'folder', enabled: true },
          workflows: [],
        },
      });
      render(<RepositoryListItem repository={repo} />);

      const link = screen.getByRole('link', { name: /owner\/repo/ });
      expect(link).toHaveAttribute('href', expect.stringContaining('git.example.com/owner/repo'));
    });

    it('should display path for local repos instead of a link', () => {
      const repo = createMockRepository({
        spec: {
          title: 'Local Repo',
          type: 'local',
          local: { path: '/var/lib/grafana/repos/test' },
          sync: { target: 'folder', enabled: true },
          workflows: [],
        },
      });
      render(<RepositoryListItem repository={repo} />);

      expect(screen.getByText('/var/lib/grafana/repos/test')).toBeInTheDocument();
    });
  });

  describe('resource stats', () => {
    it('sums the per-kind counts into one link to the repository resources tab', () => {
      const repo = createMockRepository({
        status: {
          health: { healthy: true, checked: Date.now() },
          sync: { state: 'success', message: [] },
          observedGeneration: 1,
          webhook: {},
          stats: [
            { group: 'dashboard.grafana.app', resource: 'dashboards', count: 2 },
            { group: 'folder.grafana.app', resource: 'folders', count: 1 },
            { group: 'example.grafana.app', resource: 'widgets', count: 3 },
          ],
        },
      });
      render(<RepositoryListItem repository={repo} />);

      expect(screen.getByRole('link', { name: '6 resources' })).toHaveAttribute(
        'href',
        '/admin/provisioning/test-repo?tab=resources'
      );
      expect(screen.queryByRole('link', { name: /dashboards/ })).not.toBeInTheDocument();
    });

    it('renders no resource link when the repository manages nothing', () => {
      render(<RepositoryListItem repository={createMockRepository()} />);

      expect(screen.queryByRole('link', { name: /resources/ })).not.toBeInTheDocument();
    });
  });

  // On a repository card the badge is about the repository itself, not about a resource it
  // provisions, so it says what Grafana does with it rather than telling the reader to go to
  // the page they are already on.
  it('marks a repository without a write workflow as pull only', async () => {
    const repo = createMockRepository({ spec: { ...createMockRepository().spec!, workflows: [] } });
    const { user } = render(<RepositoryListItem repository={repo} />);

    expect(screen.getByText('Pull only')).toBeInTheDocument();
    expect(screen.queryByText('Read only')).not.toBeInTheDocument();

    await user.hover(screen.getByText('Pull only'));

    expect(await screen.findByText(/Grafana only reads from this repository/)).toBeInTheDocument();
  });

  describe('export', () => {
    it('downloads the repository as a Repository manifest named after it', async () => {
      const { user } = render(<RepositoryListItem repository={createMockRepository()} />);

      await user.click(screen.getByRole('button', { name: /export/i }));

      const [blob, filename] = jest.mocked(saveAs).mock.calls[0];
      expect(filename).toBe('test-repo.json');
      expect(JSON.parse(await (blob as Blob).text())).toMatchObject({
        kind: 'Repository',
        metadata: { name: 'test-repo' },
        spec: { title: 'Test Repository', github: { url: 'https://github.com/owner/repo' } },
      });
    });
  });

  describe('externally managed repositories', () => {
    const managedRepo = (annotations: Record<string, string>) =>
      createMockRepository({ metadata: { name: 'test-repo', annotations } });

    const terraformRepo = () =>
      managedRepo({ [AnnoKeyManagerKind]: ManagerKind.Terraform, [AnnoKeyManagerIdentity]: 'terraform' });

    // A disabled LinkButton keeps its href and stays keyboard-reachable, so assert the settings
    // route is unreachable rather than just that the control looks disabled.
    const expectSettingsUnreachable = () => {
      expect(screen.queryByRole('link', { name: /settings/i })).not.toBeInTheDocument();
      const settings = screen.getByRole('button', { name: /settings/i });
      expect(settings).toHaveAttribute('aria-disabled', 'true');
      expect(settings).not.toHaveAttribute('href');
    };

    const expectSettingsReachable = () => {
      expect(screen.getByRole('link', { name: /settings/i })).toHaveAttribute(
        'href',
        '/admin/provisioning/test-repo/edit'
      );
    };

    it('makes the Settings route unreachable and shows the managed badge', () => {
      render(<RepositoryListItem repository={terraformRepo()} />);

      expectSettingsUnreachable();
      expect(screen.getByTestId('icon-exchange-alt')).toBeInTheDocument();
    });

    it('names the owning plugin in the badge tooltip, not the repository', async () => {
      const repo = managedRepo({
        [AnnoKeyManagerKind]: ManagerKind.Plugin,
        [AnnoKeyManagerIdentity]: 'grafana-slo-app',
      });
      const { user } = render(<RepositoryListItem repository={repo} />);

      await user.hover(screen.getByTestId('icon-exchange-alt'));

      expect(await screen.findByText('Managed by: Plugin grafana-slo-app')).toBeInTheDocument();
    });

    it('explains why Settings is unavailable on hover', async () => {
      const { user } = render(<RepositoryListItem repository={terraformRepo()} />);

      await user.hover(screen.getByRole('button', { name: /settings/i }));

      expect(await screen.findByText('This resource is managed externally and is read-only')).toBeInTheDocument();
    });

    it('keeps Settings reachable and hides the badge for an unmanaged repository', () => {
      render(<RepositoryListItem repository={createMockRepository()} />);

      expectSettingsReachable();
      expect(screen.queryByTestId('icon-exchange-alt')).not.toBeInTheDocument();
    });

    it('keeps Settings reachable when the manager allows edits', () => {
      const repo = managedRepo({
        [AnnoKeyManagerKind]: ManagerKind.Terraform,
        [AnnoKeyManagerIdentity]: 'terraform',
        [AnnoKeyManagerAllowsEdits]: 'true',
      });

      render(<RepositoryListItem repository={repo} />);

      expectSettingsReachable();
    });

    // A repository declared by another repository (e.g. the bootstrap one) is configured in that
    // repository's files, so Settings is closed here and it is badged read-only like any other
    // externally managed one.
    it('makes Settings unreachable and badges a git-provisioned repository read-only', () => {
      const repo = managedRepo({ [AnnoKeyManagerKind]: ManagerKind.Repo, [AnnoKeyManagerIdentity]: 'some-repo' });

      render(<RepositoryListItem repository={repo} />);

      expectSettingsUnreachable();
      expect(screen.getByText('Read only')).toBeInTheDocument();
      expect(screen.getByTestId('icon-exchange-alt')).toBeInTheDocument();
    });

    it('badges the file-provisioned bootstrap repository read-only', () => {
      const repo = managedRepo({
        [AnnoKeyManagerKind]: ManagerKind.FileProvisioning,
        [AnnoKeyManagerIdentity]: 'bootstrap',
      });

      render(<RepositoryListItem repository={repo} />);

      expect(screen.getByText('Read only')).toBeInTheDocument();
    });

    it('names the Grafana configuration as the manager of a file-provisioned repository', async () => {
      const repo = managedRepo({
        [AnnoKeyManagerKind]: ManagerKind.FileProvisioning,
        [AnnoKeyManagerIdentity]: 'bootstrap',
      });
      const { user } = render(<RepositoryListItem repository={repo} />);

      expectSettingsUnreachable();
      await user.hover(screen.getByTestId('icon-exchange-alt'));

      expect(await screen.findByText('Managed by: Grafana configuration')).toBeInTheDocument();
    });
  });
});
