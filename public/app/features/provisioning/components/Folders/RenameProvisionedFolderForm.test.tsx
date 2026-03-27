import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { RepositoryView, useReplaceRepositoryFilesWithPathMutation } from 'app/api/clients/provisioning/v0alpha1';
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
  useReplaceRepositoryFilesWithPathMutation: jest.fn(),
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

const mockUseReplaceRepositoryFilesMutation = useReplaceRepositoryFilesWithPathMutation as jest.MockedFunction<
  typeof useReplaceRepositoryFilesWithPathMutation
>;
const mockUseProvisionedFolderFormData = useProvisionedFolderFormData as jest.MockedFunction<
  typeof useProvisionedFolderFormData
>;

const mockReplaceFile = jest.fn();

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
  const mockMutationResult = [mockReplaceFile, requestState] as unknown as ReturnType<
    typeof useReplaceRepositoryFilesWithPathMutation
  >;
  const mockHookResult = hookData as ReturnType<typeof useProvisionedFolderFormData>;

  mockUseReplaceRepositoryFilesMutation.mockReturnValue(mockMutationResult);
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
    mockReplaceFile,
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
    it('should call replaceFile with folder metadata body for branch workflow', async () => {
      const branchFormData = {
        ...mockFormData,
        workflow: 'branch' as const,
        ref: 'my-branch',
      };
      const { clickRenameButton } = setup({}, { ...defaultHookData, initialValues: branchFormData });

      await clickRenameButton();

      await waitFor(() => {
        expect(mockReplaceFile).toHaveBeenCalledWith({
          name: 'test-repo',
          path: 'folders/test-folder/',
          ref: 'my-branch',
          message: 'Rename folder',
          body: {
            metadata: { name: 'folder-uid' },
            spec: { title: 'Test Folder' },
          },
        });
      });
    });

    it('should clear ref for write workflow', async () => {
      const writeFormData = {
        ...mockFormData,
        workflow: 'write' as const,
        ref: 'main',
      };
      const { clickRenameButton } = setup({}, { ...defaultHookData, initialValues: writeFormData });

      await clickRenameButton();

      await waitFor(() => {
        expect(mockReplaceFile).toHaveBeenCalledWith(
          expect.objectContaining({
            ref: undefined,
          })
        );
      });
    });

    it('should keep path unchanged (no path calculation)', async () => {
      const branchFormData = {
        ...mockFormData,
        workflow: 'branch' as const,
        ref: 'my-branch',
      };
      setup({}, { ...defaultHookData, initialValues: branchFormData });

      // Change the title — path should NOT change
      const input = screen.getByDisplayValue('Test Folder');
      await userEvent.clear(input);
      await userEvent.type(input, 'New Folder Name');

      const renameButton = screen.getByRole('button', { name: /^rename$/i });
      await userEvent.click(renameButton);

      await waitFor(() => {
        expect(mockReplaceFile).toHaveBeenCalledWith(
          expect.objectContaining({
            // Path stays the same — only the title in the body changes
            path: 'folders/test-folder/',
            body: {
              metadata: { name: 'folder-uid' },
              spec: { title: 'New Folder Name' },
            },
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
        expect(mockReplaceFile).toHaveBeenCalledWith(
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
        expect(mockReplaceFile).not.toHaveBeenCalled();
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
