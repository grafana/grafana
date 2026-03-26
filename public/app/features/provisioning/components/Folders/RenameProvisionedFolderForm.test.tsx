import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { RepositoryView, useCreateRepositoryFilesWithPathMutation } from 'app/api/clients/provisioning/v0alpha1';
import { FolderDTO } from 'app/types/folders';

import {
  ProvisionedFolderFormDataResult,
  useProvisionedFolderFormData,
} from '../../hooks/useProvisionedFolderFormData';

import { RenameProvisionedFolderForm } from './RenameProvisionedFolderForm';

// Mock dependencies
const mockNavigate = jest.fn();
jest.mock('react-router-dom-v5-compat', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ search: '' }),
}));

jest.mock('react-redux', () => {
  const actual = jest.requireActual('react-redux');
  return {
    ...actual,
    useDispatch: () => jest.fn(),
  };
});

jest.mock('app/api/clients/provisioning/v0alpha1', () => ({
  useCreateRepositoryFilesWithPathMutation: jest.fn(),
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

jest.mock('../../hooks/useProvisionedFolderFormData');

jest.mock('../Shared/ResourceEditFormSharedFields', () => ({
  ResourceEditFormSharedFields: () => <div data-testid="shared-fields" />,
}));

jest.mock('app/core/navigation/hooks', () => ({
  useUrlParams: () => [new URLSearchParams(), jest.fn()],
}));

const mockUseCreateRepositoryFilesMutation = useCreateRepositoryFilesWithPathMutation as jest.MockedFunction<
  typeof useCreateRepositoryFilesWithPathMutation
>;
const mockUseProvisionedFolderFormData = useProvisionedFolderFormData as jest.MockedFunction<
  typeof useProvisionedFolderFormData
>;

const mockCreateFile = jest.fn();

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
  workflows: [],
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

function setup(
  props: Partial<Parameters<typeof RenameProvisionedFolderForm>[0]> = {},
  hookData = defaultHookData,
  requestState: { isLoading: boolean; isSuccess: boolean; isError: boolean; error: Error | null } = {
    isLoading: false,
    isSuccess: false,
    isError: false,
    error: null,
  }
) {
  const mockMutationResult = [mockCreateFile, requestState] as unknown as ReturnType<
    typeof useCreateRepositoryFilesWithPathMutation
  >;
  const mockHookResult = hookData as ReturnType<typeof useProvisionedFolderFormData>;

  mockUseCreateRepositoryFilesMutation.mockReturnValue(mockMutationResult);
  mockUseProvisionedFolderFormData.mockReturnValue(mockHookResult);

  const onDismiss = jest.fn();
  const defaultProps = {
    folder: mockFolder,
    onDismiss,
  };

  const renderResult = render(<RenameProvisionedFolderForm {...defaultProps} {...props} />);

  const clickRenameButton = async () => {
    const renameButton = screen.getByRole('button', { name: /^rename$/i });
    await userEvent.click(renameButton);
  };

  return {
    ...renderResult,
    onDismiss,
    mockCreateFile,
    clickRenameButton,
  };
}

describe('RenameProvisionedFolderForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('rendering', () => {
    it('should render the form with pre-filled folder name', () => {
      setup();

      expect(screen.getByDisplayValue('Test Folder')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^rename$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      expect(screen.getByTestId('shared-fields')).toBeInTheDocument();
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
    it('should call createFile with correct parameters (move operation)', async () => {
      const branchFormData = {
        ...mockFormData,
        workflow: 'branch' as const,
        ref: 'my-branch',
      };
      const { clickRenameButton } = setup({}, { ...defaultHookData, initialValues: branchFormData });

      await clickRenameButton();

      await waitFor(() => {
        expect(mockCreateFile).toHaveBeenCalledWith({
          ref: 'my-branch',
          name: 'test-repo',
          path: 'folders/Test Folder/',
          originalPath: 'folders/test-folder/',
          message: 'Rename folder',
          body: {},
        });
      });
    });

    it('should call createFile with ref for branch workflow', async () => {
      const branchFormData = {
        ...mockFormData,
        workflow: 'branch' as const,
        ref: 'feature-branch',
      };
      const { clickRenameButton } = setup({}, { ...defaultHookData, initialValues: branchFormData });

      await clickRenameButton();

      await waitFor(() => {
        expect(mockCreateFile).toHaveBeenCalledWith(
          expect.objectContaining({
            ref: 'feature-branch',
          })
        );
      });
    });

    it('should use custom commit message when provided', async () => {
      const customFormData = {
        ...mockFormData,
        comment: 'Custom rename message',
      };
      const { clickRenameButton } = setup({}, { ...defaultHookData, initialValues: customFormData });

      await clickRenameButton();

      await waitFor(() => {
        expect(mockCreateFile).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Custom rename message',
          })
        );
      });
    });

    it('should not submit if repository name is missing', async () => {
      const { clickRenameButton } = setup({}, { ...defaultHookData, repository: undefined });

      await clickRenameButton();

      await waitFor(() => {
        expect(mockCreateFile).not.toHaveBeenCalled();
      });
    });

    it('should submit with updated title and correct new path', async () => {
      const branchFormData = {
        ...mockFormData,
        workflow: 'branch' as const,
        ref: 'my-branch',
      };
      setup({}, { ...defaultHookData, initialValues: branchFormData });

      const input = screen.getByDisplayValue('Test Folder');
      await userEvent.clear(input);
      await userEvent.type(input, 'New Folder Name');

      const renameButton = screen.getByRole('button', { name: /^rename$/i });
      await userEvent.click(renameButton);

      await waitFor(() => {
        expect(mockCreateFile).toHaveBeenCalledWith(
          expect.objectContaining({
            path: 'folders/New Folder Name/',
            originalPath: 'folders/test-folder/',
          })
        );
      });
    });
  });

  describe('loading state', () => {
    it('should show loading text and disable button when request is loading', () => {
      setup({}, defaultHookData, { isLoading: true, isSuccess: false, isError: false, error: null });

      const renameButton = screen.getByRole('button', { name: /renaming/i });
      expect(renameButton).toBeDisabled();
    });
  });

  describe('error handling', () => {
    it('should handle request failure gracefully', () => {
      const error = new Error('API Error');
      const errorState = { isLoading: false, isSuccess: false, isError: true, error };
      setup({}, defaultHookData, errorState);

      // Component should handle error gracefully without crashing
      expect(screen.getByRole('button', { name: /^rename$/i })).toBeInTheDocument();
    });
  });
});
