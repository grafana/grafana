import { HttpResponse, http } from 'msw';
import { render, screen, waitFor } from 'test/test-utils';

import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

import { useGetResourceRepositoryView } from '../../hooks/useGetResourceRepositoryView';
import { setupProvisioningMswServer } from '../../mocks/server';
import { type ManagedResource } from '../../utils/managedResource';

import {
  SaveProvisionedResourceDrawer,
  type SaveProvisionedResourceDrawerProps,
} from './SaveProvisionedResourceDrawer';

setupProvisioningMswServer();

jest.mock('../../hooks/usePRBranch', () => ({
  usePRBranch: jest.fn().mockReturnValue(undefined),
}));

jest.mock('../../hooks/useLastBranch', () => ({
  useLastBranch: jest.fn().mockReturnValue({
    getLastBranch: jest.fn().mockReturnValue(undefined),
    setLastBranch: jest.fn(),
  }),
}));

jest.mock('../../hooks/useGetResourceRepositoryView', () => ({
  ...jest.requireActual('../../hooks/useGetResourceRepositoryView'),
  useGetResourceRepositoryView: jest.fn(),
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
  branch: 'main',
  workflows: ['write', 'branch'],
};

const mockBody = { apiVersion: 'v1', kind: 'Thing', metadata: { name: 'thing-uid' }, spec: { title: 'Test Thing' } };

function mockRepoView(overrides = {}) {
  (useGetResourceRepositoryView as jest.Mock).mockReturnValue({
    repository: mockRepository,
    isLoading: false,
    isReadOnlyRepo: false,
    isMissingRepo: false,
    isInstanceManaged: true,
    status: 'ready',
    ...overrides,
  });
}

function setup(props: Partial<SaveProvisionedResourceDrawerProps> = {}) {
  const defaultProps: SaveProvisionedResourceDrawerProps = {
    resource: mockResource,
    resourceType: 'dashboard',
    resourceName: 'thing-uid',
    title: 'Test Thing',
    drawerTitle: 'Save provisioned thing',
    body: mockBody,
    onDismiss: jest.fn(),
  };
  return render(<SaveProvisionedResourceDrawer {...defaultProps} {...props} />);
}

function requireCapturedRequest(req: { url: URL; body: unknown } | null): { url: URL; body: unknown } {
  expect(req).not.toBeNull();
  return req as { url: URL; body: unknown };
}

describe('SaveProvisionedResourceDrawer', () => {
  let capturedRequest: { url: URL; body: unknown } | null = null;

  beforeEach(() => {
    capturedRequest = null;
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockRepoView();
  });

  it('renders the drawer header, shared fields and generic save/cancel buttons', async () => {
    setup();

    expect(await screen.findByRole('heading', { name: /save provisioned thing/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^save$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /comment/i })).toBeInTheDocument();
  });

  it('commits the provided body for the write workflow with a resource-agnostic message', async () => {
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
    expect(req.url.searchParams.get('message')).toBe('Save resource: Test Thing');
    expect(req.body).toEqual(mockBody);
  });

  it('respects a custom commit action', async () => {
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

    expect(requireCapturedRequest(capturedRequest).url.searchParams.get('message')).toBe('Create resource: Test Thing');
  });

  it('shows the read-only banner when the repository cannot be edited', () => {
    mockRepoView({ isReadOnlyRepo: true });
    setup();

    expect(screen.queryByRole('button', { name: /^save$/i })).not.toBeInTheDocument();
  });

  it('shows the missing-repository banner when no repository resolves', () => {
    mockRepoView({ repository: undefined, isMissingRepo: true });
    setup();

    expect(screen.queryByRole('button', { name: /^save$/i })).not.toBeInTheDocument();
  });
});
