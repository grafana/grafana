import { HttpResponse, delay, http } from 'msw';
import { render, screen, waitFor } from 'test/test-utils';

import { mockComboboxRect } from '@grafana/test-utils';
import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import {
  type Connection,
  type Repository,
  type RepositorySpec,
  type SecureValues,
} from 'app/api/clients/provisioning/v0alpha1';
import {
  AnnoKeyManagerAllowsEdits,
  AnnoKeyManagerIdentity,
  AnnoKeyManagerKind,
  ManagerKind,
} from 'app/features/apiserver/types';

import { setupProvisioningMswServer } from '../mocks/server';

import { ConfigForm } from './ConfigForm';

setupProvisioningMswServer();

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

const gitlabConnection: Connection = {
  metadata: { name: 'gitlab-conn' },
  spec: { type: 'gitlabOAuth', title: 'GitLab OAuth' },
  status: {
    observedGeneration: 1,
    health: { healthy: true, checked: 2 },
    conditions: [
      {
        type: 'Ready',
        status: 'True',
        reason: 'Available',
        message: '',
        lastTransitionTime: '2024-01-01T00:00:00Z',
      },
    ],
  },
};

const gitlabConnection2: Connection = {
  ...gitlabConnection,
  metadata: { name: 'gitlab-conn-2' },
  spec: { type: 'gitlabOAuth', title: 'GitLab OAuth 2' },
};

function buildRepository(withConnection: boolean, connectionName = 'gitlab-conn'): Repository {
  return {
    metadata: { name: 'repo-1' },
    spec: {
      type: 'gitlab',
      title: 'Test',
      sync: { enabled: false, target: 'folder', intervalSeconds: 60 },
      workflows: [],
      gitlab: { url: 'https://gitlab.com/g/r', branch: 'main' },
      ...(withConnection ? { connection: { name: connectionName } } : {}),
    },
  };
}

function setup(data: Repository, connections: Connection[] = [gitlabConnection]) {
  server.use(http.get(`${BASE}/connections`, () => HttpResponse.json({ items: connections })));
  return render(<ConfigForm data={data} />);
}

type CapturedBody = { spec?: RepositorySpec; secure?: SecureValues };

// Captures the bodies the form sends to the repository test and save endpoints.
function captureRepositoryWrites() {
  const bodies: { test?: CapturedBody; put?: CapturedBody } = {};
  server.use(
    http.post<{ name: string }, CapturedBody>(`${BASE}/repositories/:name/test`, async ({ request }) => {
      bodies.test = await request.json();
      return HttpResponse.json({ success: true });
    }),
    http.put<{ name: string }, CapturedBody>(`${BASE}/repositories/:name`, async ({ request }) => {
      bodies.put = await request.json();
      return HttpResponse.json(buildRepository(true));
    })
  );
  return bodies;
}

describe('ConfigForm', () => {
  it('shows the connection selector instead of token fields for connection-backed repositories', async () => {
    setup(buildRepository(true));

    expect(await screen.findByText('Connection')).toBeInTheDocument();
    expect(screen.queryByText(/Project Access Token/)).not.toBeInTheDocument();
  });

  it('shows the token field and no connection selector for PAT-based repositories', async () => {
    setup(buildRepository(false));

    expect(await screen.findByPlaceholderText('glpat-xxxxxxxxxxxxxxxxxxx')).toBeInTheDocument();
    expect(screen.queryByText('Connection')).not.toBeInTheDocument();
  });

  it('offers replacement connections for the provider when the referenced connection is missing', async () => {
    mockComboboxRect();
    const { user } = setup(buildRepository(true, 'gone-conn'));

    expect(await screen.findByText('Connection')).toBeInTheDocument();
    await user.click(screen.getByRole('combobox', { name: /Connection/ }));
    expect(await screen.findByRole('option', { name: /GitLab OAuth/ })).toBeInTheDocument();
  });

  it('sends a token removal to both test and save when switching connections', async () => {
    mockComboboxRect();
    const bodies = captureRepositoryWrites();
    const { user } = setup(buildRepository(true), [gitlabConnection, gitlabConnection2]);

    await user.click(await screen.findByRole('combobox', { name: /Connection/ }));
    await user.click(await screen.findByRole('option', { name: /GitLab OAuth 2/ }));
    await user.click(screen.getByRole('button', { name: /Save/ }));

    await waitFor(() => expect(bodies.put).toBeDefined());
    expect(bodies.test?.secure).toEqual({ token: { remove: true } });
    expect(bodies.put?.secure).toEqual({ token: { remove: true } });
    expect(bodies.put?.spec?.connection).toEqual({ name: 'gitlab-conn-2' });
  });

  it('sends a token removal when the URL of a connection-backed repository changes', async () => {
    const bodies = captureRepositoryWrites();
    const { user } = setup(buildRepository(true));

    const urlInput = await screen.findByRole('textbox', { name: /Repository URL/ });
    await user.click(urlInput);
    await user.clear(urlInput);
    await user.paste('https://gitlab.com/g/other');
    const saveButton = screen.getByRole('button', { name: /Save/ });
    await waitFor(() => expect(saveButton).toBeEnabled());
    await user.click(saveButton);

    await waitFor(() => expect(bodies.put).toBeDefined());
    expect(bodies.test?.secure).toEqual({ token: { remove: true } });
    expect(bodies.put?.secure).toEqual({ token: { remove: true } });
    expect(bodies.put?.spec?.gitlab?.url).toBe('https://gitlab.com/g/other');
  });

  it('sends no secure changes when saving without credential-relevant edits', async () => {
    const bodies = captureRepositoryWrites();
    const { user } = setup(buildRepository(true));

    const saveButton = screen.getByRole('button', { name: /Save/ });
    await waitFor(() => expect(saveButton).toBeEnabled());
    await user.click(saveButton);

    await waitFor(() => expect(bodies.put).toBeDefined());
    expect(bodies.test).not.toHaveProperty('secure');
    expect(bodies.put).not.toHaveProperty('secure');
  });

  it('blocks saving when the referenced connection no longer exists', async () => {
    const bodies = captureRepositoryWrites();
    const { user } = setup(buildRepository(true, 'gone-conn'));

    const saveButton = screen.getByRole('button', { name: /Save/ });
    await waitFor(() => expect(saveButton).toBeEnabled());
    await user.click(saveButton);

    expect(await screen.findByText('This connection no longer exists. Select a replacement.')).toBeInTheDocument();
    expect(bodies.test).toBeUndefined();
    expect(bodies.put).toBeUndefined();
  });

  it('disables Save while the connection list is loading', async () => {
    server.use(
      http.get(`${BASE}/connections`, async () => {
        await delay(400);
        return HttpResponse.json({ items: [gitlabConnection] });
      })
    );
    render(<ConfigForm data={buildRepository(true)} />);

    const saveButton = await screen.findByRole('button', { name: /Save/ });
    expect(saveButton).toBeDisabled();
    await waitFor(() => expect(saveButton).toBeEnabled());
  });

  it('falls back to server-side validation when the connection list fails to load', async () => {
    const bodies = captureRepositoryWrites();
    server.use(http.get(`${BASE}/connections`, () => HttpResponse.json({}, { status: 500 })));
    const { user } = render(<ConfigForm data={buildRepository(true)} />);

    const saveButton = await screen.findByRole('button', { name: /Save/ });
    await waitFor(() => expect(saveButton).toBeEnabled());
    await user.click(saveButton);

    await waitFor(() => expect(bodies.put).toBeDefined());
  });
  describe('externally managed repositories (read-only)', () => {
    const managedRepository = (annotations: Record<string, string>): Repository => ({
      ...buildRepository(false),
      metadata: { name: 'repo-1', annotations },
    });

    const terraformRepository = () =>
      managedRepository({ [AnnoKeyManagerKind]: ManagerKind.Terraform, [AnnoKeyManagerIdentity]: 'terraform' });

    // buildRepository is already sync-disabled, so this is the leftover of a cleared
    // bootstrap_path; the running variant overrides it.
    const bootstrapRepository = (isRunning = false): Repository => {
      const repo = managedRepository({
        [AnnoKeyManagerKind]: ManagerKind.FileProvisioning,
        [AnnoKeyManagerIdentity]: 'bootstrap',
      });
      return { ...repo, spec: { ...repo.spec!, sync: { ...repo.spec!.sync, enabled: isRunning } } };
    };

    it('shows a read-only banner', async () => {
      setup(terraformRepository());

      expect(await screen.findByText(/managed externally/i)).toBeInTheDocument();
    });

    // Save is also disabled while the connection list is in flight, so settle first to prove it is
    // the read-only gate holding it rather than a transient loading state.
    it('keeps Save disabled after the form has settled', async () => {
      setup(terraformRepository());
      await screen.findByText(/managed externally/i);

      const saveButton = await screen.findByRole('button', { name: /Save/ });
      await waitFor(() => expect(saveButton).toBeDisabled());
    });

    // defaults.ini tells the operator that clearing bootstrap_path keeps the repository "for
    // you to remove", and the admin UI is the only place most of them will look.
    it('keeps Delete available on a bootstrap repository whose path was cleared', async () => {
      setup(bootstrapRepository());

      expect(await screen.findByRole('button', { name: /Delete/ })).toBeInTheDocument();
      expect(screen.getByText(/managed externally/i)).toBeInTheDocument();
    });

    it('does not render Delete while the bootstrap repository is still configured', async () => {
      setup(bootstrapRepository(true));

      expect(await screen.findByText(/managed externally/i)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Delete/ })).not.toBeInTheDocument();
    });

    it('does not render the Delete button', async () => {
      setup(terraformRepository());
      await screen.findByText(/managed externally/i);

      expect(screen.queryByRole('button', { name: /Delete/ })).not.toBeInTheDocument();
    });

    it('stays editable for an unmanaged repository', async () => {
      setup(buildRepository(false));

      const saveButton = await screen.findByRole('button', { name: /Save/ });
      await waitFor(() => expect(saveButton).toBeEnabled());
      expect(screen.queryByText(/managed externally/i)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Delete/ })).toBeInTheDocument();
    });

    it('stays editable when the manager allows edits', async () => {
      setup(
        managedRepository({
          [AnnoKeyManagerKind]: ManagerKind.Terraform,
          [AnnoKeyManagerIdentity]: 'terraform',
          [AnnoKeyManagerAllowsEdits]: 'true',
        })
      );

      const saveButton = await screen.findByRole('button', { name: /Save/ });
      await waitFor(() => expect(saveButton).toBeEnabled());
      expect(screen.queryByText(/managed externally/i)).not.toBeInTheDocument();
    });

    // Unlike a dashboard, a repository has no edit flow that writes back through its manager:
    // this form is the only editor, so being provisioned makes it read-only here too.
    it('is read-only for a repository provisioned by another repository', async () => {
      setup(managedRepository({ [AnnoKeyManagerKind]: ManagerKind.Repo, [AnnoKeyManagerIdentity]: 'some-repo' }));

      const saveButton = await screen.findByRole('button', { name: /Save/ });
      await waitFor(() => expect(saveButton).toBeDisabled());
      expect(screen.getByText(/managed externally/i)).toBeInTheDocument();
    });
  });
});
