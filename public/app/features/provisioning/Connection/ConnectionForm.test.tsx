import { HttpResponse, delay, http } from 'msw';
import { render, screen, waitFor } from 'test/test-utils';

import { mockComboboxRect } from '@grafana/test-utils';
import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { type Connection } from 'app/api/clients/provisioning/v0alpha1';
import { AnnoKeyManagerIdentity, AnnoKeyManagerKind, ManagerKind } from 'app/features/apiserver/types';

import { setupProvisioningMswServer } from '../mocks/server';

import { ConnectionForm } from './ConnectionForm';

setupProvisioningMswServer();

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

const createMockConnection = (overrides: Partial<Connection> = {}): Connection => ({
  metadata: { name: 'test-connection' },
  spec: {
    title: 'Test Connection',
    type: 'github',
    url: 'https://github.com/settings/installations/12345678',
    github: {
      appID: '123456',
      installationID: '12345678',
    },
  },
  secure: {
    privateKey: { name: 'configured' },
  },
  status: {
    health: { healthy: true },
    observedGeneration: 1,
    conditions: [
      {
        type: 'Ready',
        status: 'True',
        reason: 'Available',
        message: 'Connection is available',
        lastTransitionTime: new Date().toISOString(),
        observedGeneration: 1,
      },
    ],
  },
  ...overrides,
});

interface SetupOptions {
  data?: Connection;
}

function setup(options: SetupOptions = {}) {
  const { data } = options;

  return render(<ConnectionForm data={data} />);
}

describe('ConnectionForm', () => {
  describe('Rendering - Create Mode', () => {
    it('should render all form fields and Save but not Delete in create mode', async () => {
      setup();

      expect(await screen.findByLabelText(/^Provider/)).toBeInTheDocument();
      expect(screen.getByLabelText(/^Title/)).toBeInTheDocument();
      expect(screen.getByLabelText(/^Description/)).toBeInTheDocument();
      expect(screen.getByLabelText(/^GitHub App ID/)).toBeInTheDocument();
      expect(screen.getByLabelText(/^GitHub Installation ID/)).toBeInTheDocument();
      expect(screen.getByLabelText(/^Private Key \(PEM\)/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^save$/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    });

    it('should allow selecting GitHub Enterprise when creating and it is available', async () => {
      mockComboboxRect();
      server.use(
        http.get(`${BASE}/settings`, () =>
          HttpResponse.json({ availableConnectionTypes: ['github', 'githubEnterprise'] })
        )
      );

      const { user } = setup();

      const providerField = await screen.findByLabelText(/^Provider/);
      await waitFor(() => {
        expect(providerField).toBeEnabled();
      });

      await user.click(providerField);
      await user.click(await screen.findByRole('option', { name: 'GitHub Enterprise' }));

      expect(providerField).toHaveDisplayValue('GitHub Enterprise');
      // Selecting GitHub Enterprise reveals the GHE-only server URL field
      expect(await screen.findByLabelText(/^Custom server URL/)).toBeInTheDocument();
    });

    it('should have Provider field disabled', async () => {
      server.use(http.get(`${BASE}/settings`, () => HttpResponse.json({ availableConnectionTypes: ['github'] })));
      setup();

      await waitFor(() => expect(screen.getByLabelText(/^Provider/)).toBeDisabled());
    });
  });

  describe('Rendering - Edit Mode', () => {
    it('should populate GitHub fields and configured key, show Delete, and omit the server URL in edit mode', () => {
      setup({ data: createMockConnection() });

      expect(screen.getByLabelText(/^GitHub App ID/)).toHaveValue('123456');
      expect(screen.getByLabelText(/^GitHub Installation ID/)).toHaveValue('12345678');
      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/^Private Key \(PEM\)/)).toHaveValue('configured');
      expect(screen.queryByLabelText(/^Custom server URL/)).not.toBeInTheDocument();
    });
  });

  describe('Rendering - externally managed (read-only)', () => {
    const managedConnection = () =>
      createMockConnection({
        metadata: {
          name: 'test-connection',
          annotations: {
            [AnnoKeyManagerKind]: ManagerKind.Terraform,
            [AnnoKeyManagerIdentity]: 'terraform',
          },
        },
      });

    const disconnectedOAuthConnection = (annotations?: Record<string, string>) =>
      createMockConnection({
        metadata: { name: 'test-connection', annotations },
        spec: { title: 'Test Connection', type: 'githubOAuth', url: 'https://github.com/org/repo' },
        status: {
          health: { healthy: false },
          observedGeneration: 1,
          conditions: [
            {
              type: 'Ready',
              status: 'False',
              reason: 'Rejected',
              message: 'The provider rejected this connection.',
              lastTransitionTime: new Date().toISOString(),
              observedGeneration: 1,
            },
          ],
        },
      });

    // Save is also disabled while the settings query is in flight (no available types yet), so wait
    // for a settings-dependent control before asserting that it is the read-only gate holding it.
    const awaitSettingsLoaded = () => screen.findByRole('radio', { name: 'GitHub App' });

    it('shows a read-only banner', () => {
      setup({ data: managedConnection() });

      expect(screen.getByText(/managed externally/i)).toBeInTheDocument();
    });

    it('keeps Save disabled once the available connection types have loaded', async () => {
      setup({ data: managedConnection() });
      await awaitSettingsLoaded();

      expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled();
    });

    it('does not render the Delete button', () => {
      setup({ data: managedConnection() });

      expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    });

    it('offers Reauthorize, which authorizes without writing the spec', async () => {
      setup({ data: disconnectedOAuthConnection({ [AnnoKeyManagerKind]: ManagerKind.Terraform }) });
      await awaitSettingsLoaded();

      expect(screen.getByRole('button', { name: /reauthorize/i })).toBeInTheDocument();
    });

    it('offers Reauthorize for an unmanaged disconnected connection', async () => {
      setup({ data: disconnectedOAuthConnection() });
      await awaitSettingsLoaded();

      expect(screen.getByRole('button', { name: /reauthorize/i })).toBeInTheDocument();
    });

    it('does not show the banner and enables Save for an unmanaged connection', async () => {
      setup({ data: createMockConnection() });
      await awaitSettingsLoaded();

      expect(screen.queryByText(/managed externally/i)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^save$/i })).toBeEnabled();
    });
  });

  describe('GitHub Enterprise', () => {
    const createEnterpriseConnection = () =>
      createMockConnection({
        spec: {
          title: 'Test GHE Connection',
          type: 'githubEnterprise',
          url: 'https://ghe.example.com/settings/installations/12345678',
          githubEnterprise: {
            appID: '123456',
            installationID: '12345678',
            serverUrl: 'https://ghe.example.com',
          },
        },
      });

    it('should render the server URL field when the connection type is githubEnterprise', () => {
      setup({ data: createEnterpriseConnection() });

      expect(screen.getByLabelText(/^Custom server URL/)).toBeInTheDocument();
      expect(screen.getByLabelText(/^Custom server URL/)).toHaveValue('https://ghe.example.com');
    });
  });

  describe('Form Validation', () => {
    it('should show required error and not submit when fields are empty', async () => {
      const { user } = setup();

      await screen.findByLabelText(/^Provider/);
      const saveButton = screen.getByRole('button', { name: /^save$/i });
      await user.click(saveButton);

      await waitFor(() => {
        // Title, App ID, Installation ID, and Private Key are all required
        expect(screen.getAllByText('This field is required')).toHaveLength(4);
      });
    });

    it('should show validation error for private key containing hidden characters', async () => {
      const { user } = setup();

      await user.type(await screen.findByLabelText(/^Title/), 'My GitHub App');
      await user.type(screen.getByLabelText(/^GitHub App ID/), '123456');
      await user.type(screen.getByLabelText(/^GitHub Installation ID/), '12345678');
      await user.click(screen.getByLabelText(/^Private Key \(PEM\)/));
      await user.paste('-----BEGIN RSA PRIVATE KEY-----\u200B...');

      await user.click(screen.getByRole('button', { name: /^save$/i }));

      await waitFor(() => {
        expect(screen.getByText(/hidden characters/i)).toBeInTheDocument();
      });
    });
  });

  describe('Form Submission - Create', () => {
    it('should send correct request body on valid submission', async () => {
      let capturedBody: unknown = null;
      server.use(
        http.post(`${BASE}/connections`, async ({ request }) => {
          capturedBody = await request.json();
          return HttpResponse.json({
            metadata: { name: 'new-conn' },
            spec: { type: 'github', title: 'My GitHub App' },
          });
        })
      );

      const { user } = setup();

      await user.type(await screen.findByLabelText(/^Title/), 'My GitHub App');
      await user.type(screen.getByLabelText(/^GitHub App ID/), '123456');
      await user.type(screen.getByLabelText(/^GitHub Installation ID/), '12345678');
      await user.type(screen.getByLabelText(/^Private Key \(PEM\)/), '-----BEGIN RSA PRIVATE KEY-----');

      const saveButton = screen.getByRole('button', { name: /^save$/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(capturedBody).not.toBeNull();
      });

      // The hook sends a Connection object with spec and base64-encoded secure field
      expect(capturedBody).toMatchObject({
        spec: {
          title: 'My GitHub App',
          type: 'github',
          github: {
            appID: '123456',
            installationID: '12345678',
          },
        },
      });
    });
  });

  describe('Form Submission - Edit', () => {
    it('should allow submission without changing private key', async () => {
      let capturedBody: unknown = null;
      server.use(
        http.put(`${BASE}/connections/:name`, async ({ request }) => {
          capturedBody = await request.json();
          return HttpResponse.json({
            metadata: { name: 'test-connection' },
            spec: { type: 'github', title: 'Test Connection' },
          });
        })
      );

      const { user } = setup({ data: createMockConnection() });

      const saveButton = screen.getByRole('button', { name: /^save$/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(capturedBody).not.toBeNull();
      });

      expect(capturedBody).toMatchObject({
        spec: {
          title: 'Test Connection',
          type: 'github',
          github: {
            appID: '123456',
            installationID: '12345678',
          },
        },
      });
    });
  });

  describe('Loading State', () => {
    it('should show Saving state while request is in flight', async () => {
      server.use(
        http.post(`${BASE}/connections`, async () => {
          await delay('infinite');
          return HttpResponse.json({});
        })
      );

      const { user } = setup();

      await user.type(await screen.findByLabelText(/^Title/), 'My GitHub App');
      await user.type(screen.getByLabelText(/^GitHub App ID/), '123456');
      await user.type(screen.getByLabelText(/^GitHub Installation ID/), '12345678');
      await user.type(screen.getByLabelText(/^Private Key \(PEM\)/), '-----BEGIN RSA PRIVATE KEY-----');

      await user.click(screen.getByRole('button', { name: /^save$/i }));

      await waitFor(() => {
        expect(screen.getByText('Saving...')).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();
    });
  });

  describe('Error Handling', () => {
    it('should map API error for appID to form field', async () => {
      server.use(
        http.post(`${BASE}/connections`, () =>
          HttpResponse.json({ errors: [{ field: 'appID', detail: 'Invalid App ID' }] }, { status: 400 })
        )
      );

      const { user } = setup();

      await user.type(await screen.findByLabelText(/^Title/), 'My GitHub App');
      await user.type(screen.getByLabelText(/^GitHub App ID/), '123456');
      await user.type(screen.getByLabelText(/^GitHub Installation ID/), '12345678');
      await user.type(screen.getByLabelText(/^Private Key \(PEM\)/), '-----BEGIN RSA PRIVATE KEY-----');

      await user.click(screen.getByRole('button', { name: /^save$/i }));

      await waitFor(() => {
        expect(screen.getByText('Invalid App ID')).toBeInTheDocument();
      });
    });

    it('should map API error for installationID to form field', async () => {
      server.use(
        http.post(`${BASE}/connections`, () =>
          HttpResponse.json(
            { errors: [{ field: 'installationID', detail: 'Invalid Installation ID' }] },
            { status: 400 }
          )
        )
      );

      const { user } = setup();

      await user.type(await screen.findByLabelText(/^Title/), 'My GitHub App');
      await user.type(screen.getByLabelText(/^GitHub App ID/), '123456');
      await user.type(screen.getByLabelText(/^GitHub Installation ID/), '12345678');
      await user.type(screen.getByLabelText(/^Private Key \(PEM\)/), '-----BEGIN RSA PRIVATE KEY-----');

      await user.click(screen.getByRole('button', { name: /^save$/i }));

      await waitFor(() => {
        expect(screen.getByText('Invalid Installation ID')).toBeInTheDocument();
      });
    });

    it('should map API error for privateKey to form field', async () => {
      server.use(
        http.post(`${BASE}/connections`, () =>
          HttpResponse.json(
            { errors: [{ field: 'secure.privateKey', detail: 'Invalid Private Key format' }] },
            { status: 400 }
          )
        )
      );

      const { user } = setup();

      await user.type(await screen.findByLabelText(/^Title/), 'My GitHub App');
      await user.type(screen.getByLabelText(/^GitHub App ID/), '123456');
      await user.type(screen.getByLabelText(/^GitHub Installation ID/), '12345678');
      await user.type(screen.getByLabelText(/^Private Key \(PEM\)/), 'invalid-key');

      await user.click(screen.getByRole('button', { name: /^save$/i }));

      await waitFor(() => {
        expect(screen.getByText('Invalid Private Key format')).toBeInTheDocument();
      });
    });

    it('should show generic error when a non-fetch error occurs during submission', async () => {
      const btoaSpy = jest.spyOn(window, 'btoa').mockImplementation(() => {
        throw new DOMException('The string contains characters outside Latin1 range');
      });

      const { user } = setup();

      await user.type(await screen.findByLabelText(/^Title/), 'My GitHub App');
      await user.type(screen.getByLabelText(/^GitHub App ID/), '123456');
      await user.type(screen.getByLabelText(/^GitHub Installation ID/), '12345678');
      await user.type(screen.getByLabelText(/^Private Key \(PEM\)/), 'some-valid-key');

      await user.click(screen.getByRole('button', { name: /^save$/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      btoaSpy.mockRestore();
    });
  });

  describe('OAuth app edit', () => {
    const createOAuthConnection = (): Connection =>
      createMockConnection({
        spec: { title: 'GitLab OAuth', type: 'gitlabOAuth', oauth: { clientID: 'old-client' } },
        secure: { clientSecret: { name: 'configured' } },
      });

    const createDisconnectedOAuthConnection = (): Connection => ({
      ...createOAuthConnection(),
      status: {
        health: { healthy: false },
        observedGeneration: 1,
        conditions: [
          {
            type: 'Ready',
            status: 'False',
            reason: 'Rejected',
            message: 'The provider rejected this connection.',
            lastTransitionTime: new Date().toISOString(),
            observedGeneration: 1,
          },
        ],
      },
    });

    beforeEach(() => {
      server.use(http.get(`${BASE}/settings`, () => HttpResponse.json({ availableConnectionTypes: ['gitlabOAuth'] })));
    });

    it('blocks saving a changed client ID until the new app secret is entered', async () => {
      let putCount = 0;
      server.use(
        http.put(`${BASE}/connections/:name`, () => {
          putCount++;
          return HttpResponse.json({});
        })
      );

      const { user } = setup({ data: createOAuthConnection() });

      const clientIDInput = await screen.findByLabelText(/^Application ID/);
      await user.clear(clientIDInput);
      await user.type(clientIDInput, 'new-client');

      await user.click(screen.getByRole('button', { name: /^save$/i }));

      expect(await screen.findByText('Enter the client secret for the new OAuth app.')).toBeInTheDocument();
      expect(putCount).toBe(0);
    });

    it('saves the new secret with the new client ID and lets the user cancel authorization', async () => {
      const tab = { closed: false, close: jest.fn(), location: { href: '' }, opener: {} };
      // Window mock is intentionally partial; the hook only touches these fields.
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const openSpy = jest.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);

      try {
        const capturedBodies: unknown[] = [];
        server.use(
          http.put(`${BASE}/connections/:name`, async ({ request }) => {
            capturedBodies.push(await request.json());
            return HttpResponse.json({
              metadata: { name: 'test-connection' },
              spec: { type: 'gitlabOAuth', title: 'GitLab OAuth' },
            });
          })
        );

        const { user } = setup({ data: createOAuthConnection() });

        const clientIDInput = await screen.findByLabelText(/^Application ID/);
        await user.clear(clientIDInput);
        await user.type(clientIDInput, 'new-client');

        await user.click(screen.getByRole('button', { name: /reset/i }));
        await user.type(screen.getByLabelText(/^Client secret/), 'new-secret');

        await user.click(screen.getByRole('button', { name: /^save$/i }));

        expect(await screen.findByText('Connecting')).toBeInTheDocument();
        // dryRun PUT arrives first, then the real one
        expect(capturedBodies).toHaveLength(2);
        expect(capturedBodies[1]).toMatchObject({
          spec: { oauth: { clientID: 'new-client' } },
          secure: { clientSecret: { create: 'new-secret' } },
        });
        expect(tab.location.href).toContain('client_id=new-client');

        await user.click(screen.getByRole('button', { name: /Cancel authorization/i }));

        expect(tab.close).toHaveBeenCalled();
        expect(screen.queryByText('Connecting')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^save$/i })).toBeEnabled();
      } finally {
        openSpy.mockRestore();
      }
    });

    it('reauthorizes from the stored configuration, ignoring form edits and writing no spec', async () => {
      const tab = { closed: false, close: jest.fn(), location: { href: '' }, opener: {} };
      // Window mock is intentionally partial; the hook only touches these fields.
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const openSpy = jest.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);

      try {
        let putCount = 0;
        server.use(
          http.put(`${BASE}/connections/:name`, () => {
            putCount++;
            return HttpResponse.json({});
          })
        );

        const { user } = setup({ data: createDisconnectedOAuthConnection() });

        const clientIDInput = await screen.findByLabelText(/^Application ID/);
        await user.clear(clientIDInput);
        await user.type(clientIDInput, 'typed-client');

        await user.click(screen.getByRole('button', { name: /reauthorize/i }));

        expect(await screen.findByText('Connecting')).toBeInTheDocument();
        expect(tab.location.href).toContain('client_id=old-client');
        expect(tab.location.href).not.toContain('typed-client');
        expect(putCount).toBe(0);
      } finally {
        openSpy.mockRestore();
      }
    });

    it('saves without authorization when the app identity is unchanged', async () => {
      let capturedBody: unknown = null;
      server.use(
        http.put(`${BASE}/connections/:name`, async ({ request }) => {
          capturedBody = await request.json();
          return HttpResponse.json({
            metadata: { name: 'test-connection' },
            spec: { type: 'gitlabOAuth', title: 'Renamed OAuth' },
          });
        })
      );

      const { user } = setup({ data: createOAuthConnection() });

      const titleInput = await screen.findByLabelText(/^Title/);
      await user.clear(titleInput);
      await user.type(titleInput, 'Renamed OAuth');

      await user.click(screen.getByRole('button', { name: /^save$/i }));

      await waitFor(() => {
        expect(capturedBody).toMatchObject({ spec: { title: 'Renamed OAuth', oauth: { clientID: 'old-client' } } });
      });
      expect(screen.queryByText('Enter the client secret for the new OAuth app.')).not.toBeInTheDocument();
      expect(screen.queryByText('Connecting')).not.toBeInTheDocument();
    });
  });
});
