import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { RepositoryView, useDeleteRepositoryFilesWithPathMutation } from 'app/api/clients/provisioning/v0alpha1';
import { FolderDTO } from 'app/types/folders';

import { ProvisionedFolderFormDataResult, useProvisionedFolderFormData } from '../hooks/useProvisionedFolderFormData';

import { DeleteProvisionedFolderForm } from './DeleteProvisionedFolderForm';

// Mock dependencies
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getAppEvents: jest.fn(() => ({
    publish: jest.fn(),
  })),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom-v5-compat', () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock('app/api/clients/provisioning/v0alpha1', () => ({
  useDeleteRepositoryFilesWithPathMutation: jest.fn(),
  provisioningAPI: {
    endpoints: {
      listRepository: {
        select: jest.fn(() => () => ({ data: { items: [] } })),
      },
    },
  },
  provisioningAPIv0alpha1: {
    endpoints: {
      listRepository: {
        select: jest.fn(() => () => ({ data: { items: [] } })),
      },
    },
  },
}));

jest.mock('../hooks/useProvisionedFolderFormData');

jest.mock('./BrowseActions/DescendantCount', () => ({
  DescendantCount: () => <div data-testid="descendant-count">2 folders, 5 dashboards</div>,
}));

jest.mock('app/features/dashboard-scene/components/Provisioned/ResourceEditFormSharedFields', () => ({
  ResourceEditFormSharedFields: () => <div data-testid="shared-fields" />,
}));

const MOCK_DATA = {
  repository: {
    name: 'test-repo',
    namespace: 'default',
    title: 'Test Repository',
    type: 'git',
  },
  resource: {
    type: {
      kind: 'Folder',
    },
    upsert: {
      apiVersion: 'v1',
      kind: 'Folder',
      metadata: { name: 'test-folder', uid: 'test-folder-uid' },
      spec: { title: 'Test Folder' },
    },
  },
};

const mockUseDeleteRepositoryFilesMutation = useDeleteRepositoryFilesWithPathMutation as jest.MockedFunction<
  typeof useDeleteRepositoryFilesWithPathMutation
>;
const mockUseProvisionedFolderFormData = useProvisionedFolderFormData as jest.MockedFunction<
  typeof useProvisionedFolderFormData
>;

const mockDeleteRepoFile = jest.fn();

const mockParentFolder: FolderDTO = {
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
  workflows: [],
};

const mockFolder = {
  metadata: {
    name: 'test-folder',
    annotations: {
      'grafana.app/sourcePath': 'folders/test-folder.json',
    },
  },
  spec: {
    title: 'Test Folder',
  },
  status: {},
};

const mockFormData = {
  repo: 'test-repo',
  path: 'folders/test-folder.json',
  ref: 'main',
  workflow: 'write' as const,
  comment: '',
  title: 'Test Folder',
};

const defaultHookData: ProvisionedFolderFormDataResult = {
  workflowOptions: [
    { label: 'Write directly', value: 'write' },
    { label: 'Create branch', value: 'branch' },
  ],
  repository: mockRepository,
  folder: mockFolder,
  initialValues: mockFormData,
};

function setup(
  props: Partial<Parameters<typeof DeleteProvisionedFolderForm>[0]> = {},
  hookData = defaultHookData,
  requestState: { isLoading: boolean; isSuccess: boolean; isError: boolean; error: Error | null } = {
    isLoading: false,
    isSuccess: false,
    isError: false,
    error: null,
  }
) {
  const mockMutationResult = [mockDeleteRepoFile, requestState] as unknown as ReturnType<
    typeof useDeleteRepositoryFilesWithPathMutation
  >;
  const mockHookResult = hookData as ReturnType<typeof useProvisionedFolderFormData>;

  mockUseDeleteRepositoryFilesMutation.mockReturnValue(mockMutationResult);
  mockUseProvisionedFolderFormData.mockReturnValue(mockHookResult);

  const onDismiss = jest.fn();
  const defaultProps = {
    parentFolder: mockParentFolder,
    onDismiss,
  };

  const renderResult = render(<DeleteProvisionedFolderForm {...defaultProps} {...props} />);

  const clickDeleteButton = async () => {
    const deleteButton = screen.getByRole('button', { name: /delete/i });
    await userEvent.click(deleteButton);
  };

  return {
    ...renderResult,
    onDismiss,
    mockDeleteRepoFile,
    mockNavigate,
    clickDeleteButton,
  };
}

describe('DeleteProvisionedFolderForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNavigate.mockClear();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    // Mock window.location.href
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
    });
  });

  describe('rendering', () => {
    it('should render component correctly ', () => {
      setup();
      // delete warning and descendant count
      expect(screen.getByText(/This will delete this folder and all its descendants/)).toBeInTheDocument();
      expect(screen.getByTestId('descendant-count')).toBeInTheDocument();

      // delete and cancel buttons
      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('should not render if initialValues is null', () => {
      setup({}, { ...defaultHookData, initialValues: undefined });
      expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    });
  });

  describe('form submission', () => {
    it('should call deleteRepoFile with correct parameters on form submission', async () => {
      const { mockDeleteRepoFile, clickDeleteButton } = setup();

      await clickDeleteButton();

      await waitFor(() => {
        expect(mockDeleteRepoFile).toHaveBeenCalledWith({
          name: 'test-repo',
          path: 'folders/test-folder.json/',
          ref: undefined, // write workflow doesn't set ref
          message: 'Delete folder: folders/test-folder.json',
        });
      });
    });

    it('should use custom commit message if provided', async () => {
      const customFormData = {
        ...mockFormData,
        comment: 'Custom delete message',
      };
      const { mockDeleteRepoFile, clickDeleteButton } = setup(
        {},
        { ...defaultHookData, initialValues: customFormData }
      );

      await clickDeleteButton();

      await waitFor(() => {
        expect(mockDeleteRepoFile).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Custom delete message',
          })
        );
      });
    });

    it('should set ref when workflow is branch', async () => {
      const branchFormData = {
        ...mockFormData,
        workflow: 'branch' as const,
        ref: 'feature-branch',
      };
      const { mockDeleteRepoFile, clickDeleteButton } = setup(
        {},
        { ...defaultHookData, initialValues: branchFormData }
      );

      await clickDeleteButton();

      await waitFor(() => {
        expect(mockDeleteRepoFile).toHaveBeenCalledWith(
          expect.objectContaining({
            ref: 'feature-branch',
          })
        );
      });
    });

    it('should not submit if repository name is missing', async () => {
      const { mockDeleteRepoFile, clickDeleteButton } = setup({}, { ...defaultHookData, repository: undefined });

      await clickDeleteButton();

      await waitFor(() => {
        expect(mockDeleteRepoFile).not.toHaveBeenCalled();
      });
    });
  });

  describe('loading state', () => {
    it('should show loading text and disable button when request is loading', () => {
      setup({}, defaultHookData, { isLoading: true, isSuccess: false, isError: false, error: null });

      const deleteButton = screen.getByRole('button', { name: /deleting/i });
      expect(deleteButton).toBeDisabled();
    });
  });

  describe('success handling', () => {
    it('should navigate to parent folder on successful write workflow', async () => {
      const successState = {
        isLoading: false,
        isSuccess: true,
        isError: false,
        error: null,
        data: MOCK_DATA,
      };
      setup({}, defaultHookData, successState);

      await waitFor(() => {
        expect(window.location.href).toBe('/dashboards/f/parent-folder-uid/');
      });
    });

    it('should navigate to dashboards root when parent folder has no parentUid', async () => {
      const folderWithoutParent = { ...mockParentFolder, parentUid: undefined };
      const successState = {
        isLoading: false,
        isSuccess: true,
        isError: false,
        error: null,
        data: MOCK_DATA,
      };
      setup({ parentFolder: folderWithoutParent }, defaultHookData, successState);

      await waitFor(() => {
        expect(window.location.href).toBe('/dashboards');
      });
    });

    it('should handle branch workflow success with navigation', async () => {
      const branchFormData = { ...mockFormData, workflow: 'branch' } as unknown as typeof mockFormData;
      const successState = {
        isLoading: false,
        isSuccess: true,
        isError: false,
        error: null,
        data: {
          urls: { newPullRequestURL: 'https://github.com/test/repo/pull/new' },
          repository: {
            name: 'test-repo',
            namespace: 'default',
            title: 'Test Repository',
            type: 'git',
          },
          resource: {
            type: {
              kind: 'Folder',
            },
            upsert: {
              apiVersion: 'v1',
              kind: 'Folder',
              metadata: { name: 'test-folder', uid: 'test-folder-uid' },
              spec: { title: 'Test Folder' },
            },
          },
          ref: 'feature-branch',
          path: 'folders/test-folder.json',
        },
      };
      const { mockNavigate } = setup({}, { ...defaultHookData, initialValues: branchFormData }, successState);

      await waitFor(() => {
        const expectedParams = new URLSearchParams();
        expectedParams.set('new_pull_request_url', 'https://github.com/test/repo/pull/new');
        expectedParams.set('repo_type', 'git');
        const expectedUrl = `/dashboards?${expectedParams.toString()}`;

        expect(mockNavigate).toHaveBeenCalledWith(expectedUrl);
      });
    });
  });

  describe('error handling', () => {
    it('should handle request failure', async () => {
      const error = new Error('API Error');
      const errorState = { isLoading: false, isSuccess: false, isError: true, error };
      setup({}, defaultHookData, errorState);

      // Component should handle error gracefully without crashing
      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
    });
  });
});
