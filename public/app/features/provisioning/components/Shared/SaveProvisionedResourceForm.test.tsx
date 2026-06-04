import { HttpResponse, http } from 'msw';
import { render, screen, waitFor } from 'test/test-utils';

import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

import { type ProvisionedResourceDataResult, useProvisionedResourceData } from '../../hooks/useProvisionedResourceData';
import { setupProvisioningMswServer } from '../../mocks/server';
import { type ManagedResource } from '../../utils/managedResource';

import { SaveProvisionedResourceForm, type SaveProvisionedResourceFormProps } from './SaveProvisionedResourceForm';

setupProvisioningMswServer();

jest.mock('../../hooks/useProvisionedRequestHandler', () => ({
  useProvisionedRequestHandler: jest.fn(),
}));

jest.mock('../../hooks/usePRBranch', () => ({
  usePRBranch: jest.fn().mockReturnValue(undefined),
}));

jest.mock('../../hooks/useLastBranch', () => ({
  useLastBranch: jest.fn().mockReturnValue({
    getLastBranch: jest.fn().mockReturnValue(undefined),
    setLastBranch: jest.fn(),
  }),
}));

jest.mock('../../hooks/useProvisionedResourceData', () => ({
  useProvisionedResourceData: jest.fn(),
}));

jest.mock('react-router-dom-v5-compat', () => {
  const actual = jest.requireActual('react-router-dom-v5-compat');
  return {
    ...actual,
    useNavigate: () => jest.fn(),
  };
});

const mockResource: ManagedResource = {
  metadata: {
    annotations: {
      'grafana.app/managedBy': 'repo',
      'grafana.app/managerId': 'test-repo',
      'grafana.app/sourcePath': 'resources/thing.json',
    },
  },
};

const mockRepository: RepositoryView = {
  name: 'test-repo',
  target: 'instance' as const,
  title: 'Test Repository',
  type: 'git' as const,
  workflows: ['write', 'branch'],
};

const mockFormData = {
  repo: 'test-repo',
  path: 'resources/thing.json',
  ref: 'main',
  workflow: 'write' as const,
  comment: '',
  title: 'Test Thing',
};

const defaultHookData: ProvisionedResourceDataResult = {
  repository: mockRepository,
  initialValues: mockFormData,
  isReadOnlyRepo: false,
  canPushToConfiguredBranch: true,
};

const mockBody = { apiVersion: 'v1', kind: 'Thing', metadata: { name: 'thing-uid' }, spec: { title: 'Test Thing' } };

function setup(props: Partial<SaveProvisionedResourceFormProps> = {}, hookData = defaultHookData) {
  (useProvisionedResourceData as jest.Mock).mockReturnValue(hookData);

  const onDismiss = jest.fn();
  const defaultProps: SaveProvisionedResourceFormProps = {
    resource: mockResource,
    resourceType: 'resource',
    resourceName: 'thing-uid',
    title: 'Test Thing',
    body: mockBody,
    onDismiss,
  };

  return {
    ...render(<SaveProvisionedResourceForm {...defaultProps} {...props} />),
    onDismiss,
  };
}

function requireCapturedRequest(req: { url: URL; body: unknown } | null): { url: URL; body: unknown } {
  expect(req).not.toBeNull();
  return req as { url: URL; body: unknown };
}

describe('SaveProvisionedResourceForm', () => {
  let capturedRequest: { url: URL; body: unknown } | null = null;

  beforeEach(() => {
    capturedRequest = null;
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('rendering', () => {
    it('renders the shared fields and save/cancel buttons standalone (no drawer)', async () => {
      setup();

      expect(await screen.findByRole('button', { name: /^save$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /comment/i })).toBeInTheDocument();
      // The form does not introduce drawer chrome on its own.
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('shows the read-only banner when the repository is read-only', () => {
      setup({}, { ...defaultHookData, isReadOnlyRepo: true });

      expect(screen.queryByRole('button', { name: /^save$/i })).not.toBeInTheDocument();
    });

    it('shows the banner when initialValues is undefined', () => {
      setup({}, { ...defaultHookData, initialValues: undefined });

      expect(screen.queryByRole('button', { name: /^save$/i })).not.toBeInTheDocument();
    });
  });

  describe('form submission', () => {
    it('commits the provided body for the write workflow without a ref', async () => {
      server.use(
        http.put(`${BASE}/repositories/:name/files/*`, async ({ request }) => {
          const url = new URL(request.url);
          capturedRequest = { url, body: await request.json() };
          return HttpResponse.json({ resource: { upsert: {} } });
        })
      );

      const { user } = setup();

      await user.click(await screen.findByRole('button', { name: /^save$/i }));

      await waitFor(() => {
        expect(capturedRequest).not.toBeNull();
      });

      const req = requireCapturedRequest(capturedRequest);
      expect(req.url.pathname).toContain('/repositories/test-repo/files/resources/thing.json');
      expect(req.url.searchParams.get('ref')).toBeNull();
      // resourceType drives the default commit message (generic fallback for unknown types)
      expect(req.url.searchParams.get('message')).toBe('Save resource: Test Thing');
      // body is passed through verbatim
      expect(req.body).toEqual(mockBody);
    });

    it('sends the selected branch as a ref for the branch workflow', async () => {
      server.use(
        http.put(`${BASE}/repositories/:name/files/*`, async ({ request }) => {
          const url = new URL(request.url);
          capturedRequest = { url, body: await request.json() };
          return HttpResponse.json({ resource: { upsert: {} } });
        })
      );

      const { user } = setup(
        {},
        { ...defaultHookData, initialValues: { ...mockFormData, workflow: 'branch' as const, ref: 'my-branch' } }
      );

      await user.click(await screen.findByRole('button', { name: /^save$/i }));

      await waitFor(() => {
        expect(capturedRequest).not.toBeNull();
      });

      const req = requireCapturedRequest(capturedRequest);
      expect(req.url.searchParams.get('ref')).toBe('my-branch');
    });

    it('respects a custom commit action via the generic fallback message', async () => {
      server.use(
        http.put(`${BASE}/repositories/:name/files/*`, async ({ request }) => {
          const url = new URL(request.url);
          capturedRequest = { url, body: await request.json() };
          return HttpResponse.json({ resource: { upsert: {} } });
        })
      );

      const { user } = setup({ action: 'create' });

      await user.click(await screen.findByRole('button', { name: /^save$/i }));

      await waitFor(() => {
        expect(capturedRequest).not.toBeNull();
      });

      const req = requireCapturedRequest(capturedRequest);
      expect(req.url.searchParams.get('message')).toBe('Create resource: Test Thing');
    });

    it('uses a custom commit message when a comment is provided', async () => {
      server.use(
        http.put(`${BASE}/repositories/:name/files/*`, async ({ request }) => {
          const url = new URL(request.url);
          capturedRequest = { url, body: await request.json() };
          return HttpResponse.json({ resource: { upsert: {} } });
        })
      );

      const { user } = setup({}, { ...defaultHookData, initialValues: { ...mockFormData, comment: 'My change' } });

      await user.click(await screen.findByRole('button', { name: /^save$/i }));

      await waitFor(() => {
        expect(capturedRequest).not.toBeNull();
      });

      const req = requireCapturedRequest(capturedRequest);
      expect(req.url.searchParams.get('message')).toBe('My change');
    });

    it('does not submit when the repository is missing', async () => {
      server.use(
        http.put(`${BASE}/repositories/:name/files/*`, async ({ request }) => {
          const url = new URL(request.url);
          capturedRequest = { url, body: await request.json() };
          return HttpResponse.json({ resource: { upsert: {} } });
        })
      );

      const { user } = setup({}, { ...defaultHookData, repository: undefined });

      await user.click(await screen.findByRole('button', { name: /^save$/i }));

      await waitFor(() => {
        expect(capturedRequest).toBeNull();
      });
    });
  });
});
