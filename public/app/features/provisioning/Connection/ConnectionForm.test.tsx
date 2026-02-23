import { HttpResponse, delay, http } from 'msw';
import { render, screen, waitFor } from 'test/test-utils';

import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { Connection } from 'app/api/clients/provisioning/v0alpha1';

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
    it('should render all form fields', () => {
      setup();

      expect(screen.getByLabelText(/^Provider/)).toBeInTheDocument();
      expect(screen.getByLabelText(/^Title/)).toBeInTheDocument();
      expect(screen.getByLabelText(/^Description/)).toBeInTheDocument();
      expect(screen.getByLabelText(/^GitHub App ID/)).toBeInTheDocument();
      expect(screen.getByLabelText(/^GitHub Installation ID/)).toBeInTheDocument();
      expect(screen.getByLabelText(/^Private Key \(PEM\)/)).toBeInTheDocument();
    });

    it('should render Save button', () => {
      setup();

      expect(screen.getByRole('button', { name: /^save$/i })).toBeInTheDocument();
    });

    it('should not render Delete button in create mode', () => {
      setup();

      expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    });

    it('should have Provider field disabled', () => {
      setup();

      expect(screen.getByLabelText(/^Provider/)).toBeDisabled();
    });
  });

  describe('Rendering - Edit Mode', () => {
    it('should populate form fields with existing connection data', () => {
      setup({ data: createMockConnection() });

      expect(screen.getByLabelText(/^GitHub App ID/)).toHaveValue('123456');
      expect(screen.getByLabelText(/^GitHub Installation ID/)).toHaveValue('12345678');
    });

    it('should render Delete button in edit mode', () => {
      setup({ data: createMockConnection() });

      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
    });

    it('should show configured state for private key', () => {
      setup({ data: createMockConnection() });

      expect(screen.getByLabelText(/^Private Key \(PEM\)/)).toHaveValue('configured');
    });
  });

  describe('Form Validation', () => {
    it('should show required error and not submit when fields are empty', async () => {
      const { user } = setup();

      const saveButton = screen.getByRole('button', { name: /^save$/i });
      await user.click(saveButton);

      await waitFor(() => {
        // Title, App ID, Installation ID, and Private Key are all required
        expect(screen.getAllByText('This field is required')).toHaveLength(4);
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

      await user.type(screen.getByLabelText(/^Title/), 'My GitHub App');
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

      await user.type(screen.getByLabelText(/^Title/), 'My GitHub App');
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

      await user.type(screen.getByLabelText(/^Title/), 'My GitHub App');
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

      await user.type(screen.getByLabelText(/^Title/), 'My GitHub App');
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

      await user.type(screen.getByLabelText(/^Title/), 'My GitHub App');
      await user.type(screen.getByLabelText(/^GitHub App ID/), '123456');
      await user.type(screen.getByLabelText(/^GitHub Installation ID/), '12345678');
      await user.type(screen.getByLabelText(/^Private Key \(PEM\)/), 'invalid-key');

      await user.click(screen.getByRole('button', { name: /^save$/i }));

      await waitFor(() => {
        expect(screen.getByText('Invalid Private Key format')).toBeInTheDocument();
      });
    });
  });
});
