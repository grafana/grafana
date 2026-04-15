import { HttpResponse, delay, http } from 'msw';
import { render, screen, waitFor } from 'test/test-utils';

import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { type FolderDTO } from 'app/types/folders';

import {
  type ProvisionedFolderFormDataResult,
  useProvisionedFolderFormData,
} from '../../hooks/useProvisionedFolderFormData';
import { setupProvisioningMswServer } from '../../mocks/server';

import { RenameProvisionedFolderForm } from './RenameProvisionedFolderForm';

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

jest.mock('../../hooks/useGetRepositoryFolders', () => ({
  useGetRepositoryFolders: jest.fn().mockReturnValue({ options: [], loading: false, error: null }),
}));

jest.mock('../../hooks/useProvisionedFolderFormData', () => ({
  useProvisionedFolderFormData: jest.fn(),
}));

jest.mock('react-router-dom-v5-compat', () => {
  const actual = jest.requireActual('react-router-dom-v5-compat');
  return {
    ...actual,
    useNavigate: () => jest.fn(),
  };
});

const mockFolder: FolderDTO = {
  id: 1,
  uid: 'folder-uid',
  title: 'Test Folder',
  url: '/dashboards/f/folder-uid/test-folder',
  hasAcl: false,
  canSave: true,
  canEdit: true,
  canAdmin: true,
  canDelete: true,
  createdBy: '',
  created: '',
  updatedBy: '',
  updated: '',
  version: 1,
  parentUid: 'parent-folder-uid',
};

const mockRepository: RepositoryView = {
  name: 'test-repo',
  target: 'folder' as const,
  title: 'Test Repository',
  type: 'git' as const,
  workflows: ['write', 'branch'],
};

const mockFormData = {
  repo: 'test-repo',
  path: 'folders/test-folder/',
  ref: 'main',
  workflow: 'write' as const,
  comment: '',
  title: 'Test Folder',
};

const defaultHookData: ProvisionedFolderFormDataResult = {
  repository: mockRepository,
  folder: {
    metadata: {
      name: 'test-folder',
      annotations: {
        'grafana.app/sourcePath': 'folders/test-folder/',
      },
    },
    spec: {
      title: 'Test Folder',
    },
  },
  initialValues: mockFormData,
  isReadOnlyRepo: false,
  canPushToConfiguredBranch: true,
};

function setup(props: Partial<Parameters<typeof RenameProvisionedFolderForm>[0]> = {}, hookData = defaultHookData) {
  (useProvisionedFolderFormData as jest.Mock).mockReturnValue(hookData);

  const onDismiss = jest.fn();
  const defaultProps = {
    folder: mockFolder,
    onDismiss,
  };

  return {
    ...render(<RenameProvisionedFolderForm {...defaultProps} {...props} />),
    onDismiss,
  };
}

function requireCapturedRequest(req: { url: URL; body: unknown } | null): { url: URL; body: unknown } {
  expect(req).not.toBeNull();
  return req as { url: URL; body: unknown };
}

describe('RenameProvisionedFolderForm', () => {
  let capturedRequest: { url: URL; body: unknown } | null = null;

  beforeEach(() => {
    capturedRequest = null;
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('rendering', () => {
    it('should render the form with pre-filled folder name', async () => {
      setup();

      expect(await screen.findByDisplayValue('Test Folder')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^rename$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      // ResourceEditFormSharedFields renders real fields (comment input)
      expect(screen.getByRole('textbox', { name: /comment/i })).toBeInTheDocument();
    });

    it('should show read-only banner when repository is read-only', () => {
      setup({}, { ...defaultHookData, isReadOnlyRepo: true });

      expect(screen.queryByRole('button', { name: /^rename$/i })).not.toBeInTheDocument();
    });

    it('should show banner when initialValues is null', () => {
      setup({}, { ...defaultHookData, initialValues: undefined });

      expect(screen.queryByRole('button', { name: /^rename$/i })).not.toBeInTheDocument();
    });
  });

  describe('form submission', () => {
    it('should call replaceFile with folder metadata body for branch workflow', async () => {
      server.use(
        http.put(`${BASE}/repositories/:name/files/*`, async ({ request }) => {
          const url = new URL(request.url);
          capturedRequest = { url, body: await request.json() };
          return HttpResponse.json({ resource: { upsert: {} } });
        })
      );

      const branchFormData = {
        ...mockFormData,
        workflow: 'branch' as const,
        ref: 'my-branch',
      };
      const { user } = setup({}, { ...defaultHookData, initialValues: branchFormData });

      const renameButton = await screen.findByRole('button', { name: /^rename$/i });
      await user.click(renameButton);

      await waitFor(() => {
        expect(capturedRequest).not.toBeNull();
      });

      const request = requireCapturedRequest(capturedRequest);
      expect(request.url.pathname).toContain('/repositories/test-repo/files/');
      expect(request.url.searchParams.get('ref')).toBe('my-branch');
      expect(request.url.searchParams.get('message')).toBe('Rename folder');
      // No metadata.name — omitting the ID lets the backend preserve the existing UID from the repo.
      expect(request.body).toEqual({
        spec: { title: 'Test Folder' },
      });
    });

    it('should clear ref for write workflow', async () => {
      server.use(
        http.put(`${BASE}/repositories/:name/files/*`, async ({ request }) => {
          const url = new URL(request.url);
          capturedRequest = { url, body: await request.json() };
          return HttpResponse.json({ resource: { upsert: {} } });
        })
      );

      const writeFormData = {
        ...mockFormData,
        workflow: 'write' as const,
        ref: 'main',
      };
      const { user } = setup({}, { ...defaultHookData, initialValues: writeFormData });

      const renameButton = await screen.findByRole('button', { name: /^rename$/i });
      await user.click(renameButton);

      await waitFor(() => {
        expect(capturedRequest).not.toBeNull();
      });

      const request = requireCapturedRequest(capturedRequest);
      // Write workflow sends no ref query param
      expect(request.url.searchParams.get('ref')).toBeNull();
    });

    it('should keep path unchanged (no path calculation)', async () => {
      server.use(
        http.put(`${BASE}/repositories/:name/files/*`, async ({ request }) => {
          const url = new URL(request.url);
          capturedRequest = { url, body: await request.json() };
          return HttpResponse.json({ resource: { upsert: {} } });
        })
      );

      const branchFormData = {
        ...mockFormData,
        workflow: 'branch' as const,
        ref: 'my-branch',
      };
      const { user } = setup({}, { ...defaultHookData, initialValues: branchFormData });

      // Change the title — path should NOT change
      const input = await screen.findByDisplayValue('Test Folder');
      await user.clear(input);
      await user.type(input, 'New Folder Name');

      const renameButton = screen.getByRole('button', { name: /^rename$/i });
      await user.click(renameButton);

      await waitFor(() => {
        expect(capturedRequest).not.toBeNull();
      });

      const request = requireCapturedRequest(capturedRequest);
      // Path stays the same — only the title in the body changes
      expect(request.url.pathname).toContain('folders/test-folder/');
      // No metadata.name — omitting the ID lets the backend preserve the existing UID from the repo.
      expect(request.body).toEqual({
        spec: { title: 'New Folder Name' },
      });
    });

    it('should send path from initialValues directly without modification', async () => {
      server.use(
        http.put(`${BASE}/repositories/:name/files/*`, async ({ request }) => {
          const url = new URL(request.url);
          capturedRequest = { url, body: await request.json() };
          return HttpResponse.json({ resource: { upsert: {} } });
        })
      );

      // The hook normalizes the trailing slash; the form must pass it through as-is.
      const formDataWithTrailingSlash = {
        ...mockFormData,
        path: 'folders/my-folder/',
        workflow: 'branch' as const,
        ref: 'my-branch',
      };
      const { user } = setup({}, { ...defaultHookData, initialValues: formDataWithTrailingSlash });

      const renameButton = await screen.findByRole('button', { name: /^rename$/i });
      await user.click(renameButton);

      await waitFor(() => {
        expect(capturedRequest).not.toBeNull();
      });

      const request = requireCapturedRequest(capturedRequest);
      expect(request.url.pathname).toContain('folders/my-folder/');
    });

    it('should use custom commit message when provided', async () => {
      server.use(
        http.put(`${BASE}/repositories/:name/files/*`, async ({ request }) => {
          const url = new URL(request.url);
          capturedRequest = { url, body: await request.json() };
          return HttpResponse.json({ resource: { upsert: {} } });
        })
      );

      const customFormData = {
        ...mockFormData,
        comment: 'Custom rename message',
      };
      const { user } = setup({}, { ...defaultHookData, initialValues: customFormData });

      const renameButton = await screen.findByRole('button', { name: /^rename$/i });
      await user.click(renameButton);

      await waitFor(() => {
        expect(capturedRequest).not.toBeNull();
      });

      const request = requireCapturedRequest(capturedRequest);
      expect(request.url.searchParams.get('message')).toBe('Custom rename message');
    });

    it('should not submit if repository name is missing', async () => {
      server.use(
        http.put(`${BASE}/repositories/:name/files/*`, async ({ request }) => {
          const url = new URL(request.url);
          capturedRequest = { url, body: await request.json() };
          return HttpResponse.json({ resource: { upsert: {} } });
        })
      );

      const { user } = setup({}, { ...defaultHookData, repository: undefined });

      const renameButton = await screen.findByRole('button', { name: /^rename$/i });
      await user.click(renameButton);

      // Give some time for a request to fire (it should not)
      await waitFor(() => {
        expect(capturedRequest).toBeNull();
      });
    });
  });

  describe('loading state', () => {
    it('should show loading text and disable button when request is loading', async () => {
      server.use(
        http.put(`${BASE}/repositories/:name/files/*`, async () => {
          await delay('infinite');
          return HttpResponse.json({});
        })
      );

      const { user } = setup();

      const renameButton = await screen.findByRole('button', { name: /^rename$/i });
      await user.click(renameButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /renaming/i })).toBeDisabled();
      });
    });
  });

  describe('error handling', () => {
    it('should handle request failure gracefully', async () => {
      server.use(
        http.put(`${BASE}/repositories/:name/files/*`, () => {
          return HttpResponse.json({ message: 'API Error' }, { status: 500 });
        })
      );

      const { user } = setup();

      const renameButton = await screen.findByRole('button', { name: /^rename$/i });
      await user.click(renameButton);

      // Component should handle error gracefully without crashing
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^rename$/i })).toBeInTheDocument();
      });
    });
  });
});
