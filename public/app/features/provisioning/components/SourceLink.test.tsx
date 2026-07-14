import { HttpResponse, http } from 'msw';
import { render, screen, waitFor } from 'test/test-utils';

import { config } from '@grafana/runtime';
import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

import { setupProvisioningMswServer } from '../mocks/server';

import { SourceLink } from './SourceLink';

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

/** Override the frontend settings endpoint that `useGetResourceRepositoryView` reads from. */
function mockRepositories(repositories: RepositoryView[]) {
  let requested = false;
  server.use(
    http.get(`${BASE}/settings`, () => {
      requested = true;
      return HttpResponse.json({ items: repositories });
    })
  );
  return () => requested;
}

describe('SourceLink', () => {
  let originalProvisioning: boolean | undefined;

  beforeEach(() => {
    originalProvisioning = config.featureToggles.provisioning;
    config.featureToggles.provisioning = true;
  });

  afterEach(() => {
    config.featureToggles.provisioning = originalProvisioning;
  });

  it('renders a link to the source file in a GitHub repository', async () => {
    mockRepositories([makeRepository({ type: 'github', url: 'https://github.com/grafana/repo', branch: 'main' })]);

    render(<SourceLink repositoryName="my-repo" sourcePath="playlists/foo.json" />);

    const link = await screen.findByRole('link', { name: /source \(github\)/i });
    expect(link).toHaveAttribute('href', 'https://github.com/grafana/repo/blob/main/playlists/foo.json');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('prefixes the repository path when present', async () => {
    mockRepositories([
      makeRepository({ type: 'github', url: 'https://github.com/grafana/repo', branch: 'main', path: 'grafana' }),
    ]);

    render(<SourceLink repositoryName="my-repo" sourcePath="playlists/foo.json" />);

    expect(await screen.findByRole('link', { name: /source \(github\)/i })).toHaveAttribute(
      'href',
      'https://github.com/grafana/repo/blob/main/grafana/playlists/foo.json'
    );
  });

  it('renders a link for a GitHub Enterprise repository', async () => {
    mockRepositories([
      makeRepository({ type: 'githubEnterprise', url: 'https://ghe.example.com/grafana/repo', branch: 'main' }),
    ]);

    render(<SourceLink repositoryName="my-repo" sourcePath="playlists/foo.json" />);

    expect(await screen.findByRole('link', { name: /source \(github enterprise\)/i })).toHaveAttribute(
      'href',
      'https://ghe.example.com/grafana/repo/blob/main/playlists/foo.json'
    );
  });

  it('renders nothing without a source path', () => {
    // No source path skips the query entirely, so the component resolves synchronously.
    const { container } = render(<SourceLink repositoryName="my-repo" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the repository cannot be resolved', async () => {
    const wasRequested = mockRepositories([]);

    render(<SourceLink repositoryName="my-repo" sourcePath="playlists/foo.json" />);

    await waitFor(() => expect(wasRequested()).toBe(true));
    expect(screen.queryByRole('link', { name: /source/i })).not.toBeInTheDocument();
  });

  it('renders nothing for non-git providers (local)', async () => {
    const wasRequested = mockRepositories([makeRepository({ type: 'local' })]);

    render(<SourceLink repositoryName="my-repo" sourcePath="playlists/foo.json" />);

    await waitFor(() => expect(wasRequested()).toBe(true));
    expect(screen.queryByRole('link', { name: /source/i })).not.toBeInTheDocument();
  });

  it('renders nothing for generic git providers', async () => {
    const wasRequested = mockRepositories([
      makeRepository({ type: 'git', url: 'https://example.com/grafana/repo', branch: 'main' }),
    ]);

    render(<SourceLink repositoryName="my-repo" sourcePath="playlists/foo.json" />);

    await waitFor(() => expect(wasRequested()).toBe(true));
    expect(screen.queryByRole('link', { name: /source/i })).not.toBeInTheDocument();
  });

  it('renders nothing when the provisioning feature toggle is off', () => {
    // Toggle off skips the query entirely, so the component resolves synchronously.
    config.featureToggles.provisioning = false;
    const { container } = render(<SourceLink repositoryName="my-repo" sourcePath="playlists/foo.json" />);
    expect(container).toBeEmptyDOMElement();
  });
});
