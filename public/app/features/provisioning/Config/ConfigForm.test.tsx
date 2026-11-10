import { HttpResponse, delay, http } from 'msw';
import { render, screen, waitFor } from 'test/test-utils';

import { config } from '@grafana/runtime';
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

    it('stays editable for git-provisioned repositories, which have their own edit flow', async () => {
      setup(managedRepository({ [AnnoKeyManagerKind]: ManagerKind.Repo, [AnnoKeyManagerIdentity]: 'some-repo' }));

      const saveButton = await screen.findByRole('button', { name: /Save/ });
      await waitFor(() => expect(saveButton).toBeEnabled());
      expect(screen.queryByText(/managed externally/i)).not.toBeInTheDocument();
    });
  });

  describe('source repositories', () => {
    const sourceUrl = 'https://sources.example.com/v1/sources/stacks-1';
    const sourceConnection: Connection = {
      ...gitlabConnection,
      metadata: { name: 'source-conn' },
      spec: {
        type: 'source',
        title: 'Source client credentials',
        source: { tokenURL: 'https://idp.example.com/token' },
      },
    };

    function buildSourceRepository(source: RepositorySpec['source'] = {}, secure?: SecureValues): Repository {
      return {
        metadata: { name: 'source-1' },
        spec: {
          type: 'source',
          title: 'Source',
          sync: { enabled: true, target: 'instance', intervalSeconds: 60 },
          workflows: [],
          source: { url: sourceUrl, auth: { type: 'bearer' }, ...source },
        },
        secure,
      };
    }

    async function saveForm(user: ReturnType<typeof setup>['user']) {
      const saveButton = await screen.findByRole('button', { name: /Save/ });
      await waitFor(() => expect(saveButton).toBeEnabled());
      await user.click(saveButton);
    }

    it('shows the source fields and none of the git-only sections', async () => {
      setup(buildSourceRepository(), [sourceConnection]);

      expect(await screen.findByRole('textbox', { name: /Source URL/ })).toHaveValue(sourceUrl);
      expect(screen.getByRole('textbox', { name: /Repository type/ })).toHaveValue('Source API');
      expect(
        screen.getByText(/the kinds the source may write. when empty, only dashboards are allowed/i)
      ).toBeInTheDocument();
      expect(screen.getByText('TLS options')).toBeInTheDocument();
      expect(screen.getByText('Automatic pulling')).toBeInTheDocument();
      expect(screen.queryByRole('checkbox', { name: /Read only/ })).not.toBeInTheDocument();
      expect(screen.queryByText('Branch')).not.toBeInTheDocument();
      expect(screen.queryByText('Path')).not.toBeInTheDocument();
      expect(screen.queryByText('Commit options')).not.toBeInTheDocument();
      expect(screen.queryByText('Branch options')).not.toBeInTheDocument();
      expect(screen.queryByText('Pull request options')).not.toBeInTheDocument();
      expect(screen.queryByText('Webhook options')).not.toBeInTheDocument();
    });

    it('saves a bearer source as a read-only spec with the new token', async () => {
      const bodies = captureRepositoryWrites();
      const { user } = setup(buildSourceRepository(), [sourceConnection]);

      await user.type(await screen.findByLabelText(/^Bearer token/), 'new-token');
      await saveForm(user);

      await waitFor(() => expect(bodies.put).toBeDefined());
      expect(bodies.put?.spec).toMatchObject({
        type: 'source',
        workflows: [],
        source: { url: sourceUrl, auth: { type: 'bearer' }, emptyTreePolicy: 'refuse' },
      });
      expect(bodies.put?.spec?.connection).toBeUndefined();
      expect(bodies.put?.secure).toEqual({ token: { create: 'new-token' } });
      expect(bodies.test?.secure).toEqual({ token: { create: 'new-token' } });
    });

    it('keeps the stored token when saving a bearer source without touching it', async () => {
      const bodies = captureRepositoryWrites();
      const { user } = setup(buildSourceRepository({}, { token: { name: 'stored-token' } }), [sourceConnection]);

      expect(await screen.findByRole('button', { name: /Reset/ })).toBeInTheDocument();
      await saveForm(user);

      await waitFor(() => expect(bodies.put).toBeDefined());
      expect(bodies.put).not.toHaveProperty('secure');
    });

    it('requires a bearer token when none is stored', async () => {
      const bodies = captureRepositoryWrites();
      const { user } = setup(buildSourceRepository(), [sourceConnection]);

      await saveForm(user);

      expect(await screen.findByText('Bearer token is required')).toBeInTheDocument();
      expect(bodies.put).toBeUndefined();
    });

    it('switches to client credentials by referencing a source connection and removing the stored token', async () => {
      mockComboboxRect();
      const bodies = captureRepositoryWrites();
      const { user } = setup(buildSourceRepository({}, { token: { name: 'stored-token' } }), [
        gitlabConnection,
        sourceConnection,
      ]);

      await user.click(await screen.findByRole('combobox', { name: /Authentication/ }));
      await user.click(await screen.findByRole('option', { name: /Client credentials/ }));

      expect(screen.queryByLabelText(/^Bearer token/)).not.toBeInTheDocument();
      await user.click(await screen.findByRole('combobox', { name: /Connection/ }));
      // Only connections of the source type are offered.
      expect(await screen.findByRole('option', { name: /Source client credentials/ })).toBeInTheDocument();
      expect(screen.queryByRole('option', { name: /GitLab OAuth/ })).not.toBeInTheDocument();
      await user.click(screen.getByRole('option', { name: /Source client credentials/ }));
      await saveForm(user);

      await waitFor(() => expect(bodies.put).toBeDefined());
      expect(bodies.put?.spec?.source?.auth).toEqual({ type: 'clientCredentials' });
      expect(bodies.put?.spec?.connection).toEqual({ name: 'source-conn' });
      expect(bodies.put?.secure).toEqual({ token: { remove: true } });
    });

    it('requires a connection for client credentials', async () => {
      const bodies = captureRepositoryWrites();
      const { user } = setup(buildSourceRepository({ auth: { type: 'clientCredentials' } }), [sourceConnection]);

      await saveForm(user);

      expect(await screen.findByText('A source connection is required')).toBeInTheDocument();
      expect(bodies.put).toBeUndefined();
    });

    it('saves edited allowed kinds, the empty tree policy and TLS settings', async () => {
      mockComboboxRect();
      const bodies = captureRepositoryWrites();
      const { user } = setup(
        buildSourceRepository(
          { allow: [{ group: 'dashboard.grafana.app', kind: 'Dashboard' }] },
          { token: { name: 'stored-token' } }
        ),
        [sourceConnection]
      );

      await user.click(await screen.findByRole('button', { name: /Add kind/ }));
      await user.type(screen.getByRole('textbox', { name: 'Group of allowed kind 2' }), 'playlist.grafana.app');
      await user.type(screen.getByRole('textbox', { name: 'Kind of allowed kind 2' }), 'Playlist');
      await user.click(screen.getByRole('button', { name: 'Remove allowed kind 1' }));

      await user.click(screen.getByRole('combobox', { name: /When the source is empty/ }));
      await user.click(await screen.findByRole('option', { name: /Allow/ }));

      await user.click(screen.getByText('TLS options'));
      await user.type(screen.getByRole('textbox', { name: /Server name/ }), 'sources.internal');
      await saveForm(user);

      await waitFor(() => expect(bodies.put).toBeDefined());
      expect(bodies.put?.spec?.source).toEqual({
        url: sourceUrl,
        auth: { type: 'bearer' },
        allow: [{ group: 'playlist.grafana.app', kind: 'Playlist' }],
        emptyTreePolicy: 'allow',
        tls: { serverName: 'sources.internal' },
      });
    });

    it('blocks saving an allowed kind that has no kind', async () => {
      const bodies = captureRepositoryWrites();
      const { user } = setup(buildSourceRepository({}, { token: { name: 'stored-token' } }), [sourceConnection]);

      await user.click(await screen.findByRole('button', { name: /Add kind/ }));
      await user.type(screen.getByRole('textbox', { name: 'Group of allowed kind 1' }), 'dashboard.grafana.app');
      await saveForm(user);

      expect(await screen.findByText('Every allowed kind needs a group and a kind.')).toBeInTheDocument();
      expect(bodies.put).toBeUndefined();
    });

    it('shows backend field errors on the source URL', async () => {
      server.use(
        http.post(`${BASE}/repositories/:name/test`, () =>
          HttpResponse.json(
            { errors: [{ field: 'spec.source.url', detail: 'source URL must use https://' }] },
            { status: 400 }
          )
        )
      );
      const { user } = setup(buildSourceRepository({}, { token: { name: 'stored-token' } }), [sourceConnection]);

      await saveForm(user);

      expect(await screen.findByText('source URL must use https://')).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /Source URL/ })).toBeInvalid();
    });

    describe('token exchange option', () => {
      const originalNamespace = config.namespace;
      afterEach(() => {
        config.namespace = originalNamespace;
      });

      it.each([
        { name: 'on-prem instances', namespace: 'default', offered: false },
        { name: 'hosted instances', namespace: 'stacks-123', offered: true },
      ])('is offered only where token exchange exists: $name', async ({ namespace, offered }) => {
        mockComboboxRect();
        config.namespace = namespace;
        const { user } = setup(buildSourceRepository(), [sourceConnection]);

        await user.click(await screen.findByRole('combobox', { name: /Authentication/ }));

        expect(await screen.findByRole('option', { name: /Bearer token/ })).toBeInTheDocument();
        expect(Boolean(screen.queryByRole('option', { name: /Token exchange/ }))).toBe(offered);
      });

      it('stays selectable for a repository that already uses it, without asking for a token', async () => {
        const bodies = captureRepositoryWrites();
        const { user } = setup(buildSourceRepository({ auth: { type: 'tokenExchange' } }), [sourceConnection]);

        expect(await screen.findByRole('combobox', { name: /Authentication/ })).toHaveDisplayValue('Token exchange');
        expect(screen.queryByLabelText(/^Bearer token/)).not.toBeInTheDocument();
        await saveForm(user);

        await waitFor(() => expect(bodies.put).toBeDefined());
        expect(bodies.put?.spec?.source?.auth).toEqual({ type: 'tokenExchange' });
        expect(bodies.put).not.toHaveProperty('secure');
      });
    });
  });
});
