import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormEvent } from 'react';
import { useForm, UseFormReturn, FieldValues } from 'react-hook-form';

import { AppEvents } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';
import { useDeleteRepositoryFilesWithPathMutation } from 'app/api/clients/provisioning/v0alpha1';
import { FolderDTO } from 'app/types';

import { ProvisionedFolderFormDataResult, useProvisionedFolderFormData } from '../hooks/useProvisionedFolderFormData';
import { DashboardTreeSelection } from '../types';

import { DeleteProvisionedFolderForm } from './DeleteProvisionedFolderForm';

jest.mock('app/api/clients/provisioning/v0alpha1', () => ({
  useDeleteRepositoryFilesWithPathMutation: jest.fn(),
}));

jest.mock('../hooks/useProvisionedFolderFormData');

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getAppEvents: jest.fn(),
}));

jest.mock('react-hook-form', () => ({
  ...jest.requireActual('react-hook-form'),
  useForm: jest.fn(),
}));

jest.mock('app/features/dashboard-scene/components/Provisioned/DashboardEditFormSharedFields', () => ({
  DashboardEditFormSharedFields: ({ workflow }: { workflow: string }) => (
    <div data-testid="shared-fields">
      <input data-testid="workflow-input" value={workflow} readOnly />
    </div>
  ),
}));

jest.mock('./BrowseActions/DescendantCount', () => ({
  DescendantCount: ({ selectedItems }: { selectedItems: DashboardTreeSelection }) => (
    <div data-testid="descendant-count">Descendant count for folder: {Object.keys(selectedItems.folder)[0]}</div>
  ),
}));

// Mock navigation
const mockLocationAssign = jest.fn();
Object.defineProperty(window, 'location', {
  value: { href: '', assign: mockLocationAssign },
  writable: true,
});

const mockDeleteRepoFile = jest.fn();
const mockPublish = jest.fn();
const mockHandleSubmit = jest.fn();
const mockWatch = jest.fn();
const mockReset = jest.fn();

const mockUseDeleteRepositoryFiles = useDeleteRepositoryFilesWithPathMutation as jest.MockedFunction<
  typeof useDeleteRepositoryFilesWithPathMutation
>;
const mockUseProvisionedFolderFormData = useProvisionedFolderFormData as jest.MockedFunction<
  typeof useProvisionedFolderFormData
>;
const mockUseForm = useForm as jest.MockedFunction<typeof useForm>;

// Mock request state helper
type MockRequestState = {
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  error?: Error;
  reset: () => void;
};

const createMockRequestState = (overrides: Partial<MockRequestState> = {}): MockRequestState => ({
  isLoading: false,
  isSuccess: false,
  isError: false,
  reset: jest.fn(),
  ...overrides,
});

interface SetupOptions {
  parentFolder?: Partial<FolderDTO>;
  requestState?: Partial<MockRequestState>;
  formData?: Partial<ProvisionedFolderFormDataResult>;
  workflow?: 'branch' | 'write';
  formValues?: {
    repo?: string;
    path?: string;
    comment?: string;
    ref?: string;
  };
}

const createMockFolder = (overrides: Partial<FolderDTO> = {}): FolderDTO => ({
  uid: 'test-folder-uid',
  title: 'Test Folder',
  canAdmin: true,
  canDelete: true,
  canEdit: true,
  canSave: true,
  created: '2023-01-01T00:00:00Z',
  createdBy: 'test-user',
  hasAcl: false,
  id: 1,
  updated: '2023-01-01T00:00:00Z',
  updatedBy: 'test-user',
  url: '/dashboards/f/test-folder-uid',
  accessControl: {},
  ...overrides,
});

const mockFolderObj = {
  metadata: {
    annotations: {
      'grafana.app/sourcePath': 'folders/test-folder.yaml',
    },
  },
  spec: {
    title: 'Test Folder',
  },
  status: {},
};

function setup(options: SetupOptions = {}) {
  const { parentFolder, requestState = {}, formData = {}, workflow = 'branch', formValues = {} } = options;
  const user = userEvent.setup();

  const defaultParentFolder = createMockFolder({
    parentUid: 'parent-folder-uid',
    ...parentFolder,
  });

  const defaultFormData: ProvisionedFolderFormDataResult = {
    workflowOptions: [
      { label: 'Branch', value: 'branch' },
      { label: 'Write', value: 'write' },
    ],
    isGitHub: true,
    repository: {
      name: 'test-repo',
      target: 'folder' as const,
      title: 'Test Repository',
      type: 'github' as const,
      workflows: ['branch', 'write'] as Array<'branch' | 'write'>,
    },
    folder: mockFolderObj,
    ...formData,
  };

  // Default form values
  const defaultFormValues = {
    repo: 'test-repo',
    path: 'folders/test.yaml',
    comment: '',
    ref: 'test-ref',
    ...formValues,
  };

  // Set up form mocks
  mockHandleSubmit.mockImplementation((callback) => (e?: FormEvent) => {
    e?.preventDefault?.();
    callback(defaultFormValues);
  });

  mockWatch.mockReturnValue([defaultFormValues.ref, workflow]);

  mockUseForm.mockReturnValue({
    handleSubmit: mockHandleSubmit,
    watch: mockWatch,
    reset: mockReset,
  } as unknown as UseFormReturn<FieldValues>);

  // Set up other mocks
  mockUseProvisionedFolderFormData.mockReturnValue(defaultFormData);
  mockUseDeleteRepositoryFiles.mockReturnValue([
    mockDeleteRepoFile,
    createMockRequestState(requestState) as ReturnType<typeof useDeleteRepositoryFilesWithPathMutation>[1],
  ]);

  (getAppEvents as jest.Mock).mockReturnValue({
    publish: mockPublish,
  });

  return {
    user,
    parentFolder: defaultParentFolder,
    ...render(<DeleteProvisionedFolderForm parentFolder={parentFolder ? defaultParentFolder : undefined} />),
  };
}

describe('DeleteProvisionedFolderForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset window.location.href
    window.location.href = '';

    mockHandleSubmit.mockClear();
    mockWatch.mockClear();
    mockReset.mockClear();
  });

  describe('Rendering', () => {
    it('should render the form with correct elements', () => {
      setup();

      expect(screen.getByTestId('descendant-count')).toBeInTheDocument();
      expect(screen.getByTestId('shared-fields')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('should render descendant count with correct folder uid', () => {
      const parentFolder = { uid: 'test-folder-123', title: 'Test Folder' };
      setup({ parentFolder });

      expect(screen.getByTestId('descendant-count')).toHaveTextContent('test-folder-123');
    });

    it('should show loading state when deletion is in progress', () => {
      setup({
        requestState: {
          isLoading: true,
        },
      });

      const deleteButton = screen.getByRole('button', { name: /deleting/i });
      expect(deleteButton).toBeDisabled();
      expect(deleteButton).toHaveTextContent('Deleting...');
    });

    it('should render shared form fields with correct workflow', () => {
      setup({ workflow: 'write' });

      const workflowInput = screen.getByTestId('workflow-input');
      expect(workflowInput).toHaveValue('write');
    });
  });

  describe('Hook Integration', () => {
    it('should call useProvisionedFolderFormData with correct parameters', () => {
      const parentFolder = { uid: 'test-folder', title: 'Test Folder' };
      setup({ parentFolder });

      expect(mockUseProvisionedFolderFormData).toHaveBeenCalledWith({
        folderUid: 'test-folder',
        action: 'delete',
        reset: expect.any(Function),
        title: 'Test Folder',
      });
    });

    it('should call useProvisionedFolderFormData with undefined when no parent folder', () => {
      setup({ parentFolder: undefined });

      expect(mockUseProvisionedFolderFormData).toHaveBeenCalledWith({
        folderUid: undefined,
        action: 'delete',
        reset: expect.any(Function),
        title: undefined,
      });
    });
  });

  describe('Form Submission', () => {
    it('should submit form with correct parameters for branch workflow', async () => {
      const { user } = setup({
        workflow: 'branch',
        formData: {
          folder: mockFolderObj,
        },
        formValues: {
          repo: 'test-repo',
          path: 'folders/test.yaml',
          ref: 'test-branch',
        },
      });

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      await waitFor(() => {
        expect(mockDeleteRepoFile).toHaveBeenCalledWith({
          name: 'test-repo',
          path: 'folders/test.yaml/',
          ref: 'test-branch',
          message: `Delete folder: ${mockFolderObj.metadata.annotations['grafana.app/sourcePath']}`,
        });
      });
    });

    it('should submit form with correct parameters for write workflow', async () => {
      const { user } = setup({
        workflow: 'write',
        formData: {
          folder: mockFolderObj,
        },
        formValues: {
          repo: 'test-repo',
          path: 'folders/test.yaml',
        },
      });

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      await waitFor(() => {
        expect(mockDeleteRepoFile).toHaveBeenCalledWith({
          name: 'test-repo',
          path: 'folders/test.yaml/',
          ref: undefined, // write workflow uses undefined ref
          message: `Delete folder: ${mockFolderObj.metadata.annotations['grafana.app/sourcePath']}`,
        });
      });
    });

    it('should not submit when repository name is missing', async () => {
      const { user } = setup({
        formData: {
          repository: undefined,
        },
      });

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      expect(mockDeleteRepoFile).not.toHaveBeenCalled();
    });
  });

  describe('Success Handling', () => {
    it('should navigate to parent folder when deletion succeeds and parent folder has parentUid', async () => {
      const parentFolder = {
        uid: 'current-folder',
        title: 'Current Folder',
        parentUid: 'parent-folder-uid',
      };

      setup({
        parentFolder,
        requestState: { isSuccess: true },
        workflow: 'write',
      });

      await waitFor(() => {
        expect(window.location.href).toBe('/dashboards/f/parent-folder-uid/');
      });

      expect(mockPublish).toHaveBeenCalledWith({
        type: AppEvents.alertSuccess.name,
        payload: ['Folder deleted successfully'],
      });
    });

    it('should navigate to dashboards root when deletion succeeds and no parentUid', async () => {
      const parentFolder = {
        uid: 'current-folder',
        title: 'Current Folder',
        parentUid: undefined,
      };

      setup({
        parentFolder,
        requestState: { isSuccess: true },
        workflow: 'write',
      });

      await waitFor(() => {
        expect(window.location.href).toBe('/dashboards');
      });

      expect(mockPublish).toHaveBeenCalledWith({
        type: AppEvents.alertSuccess.name,
        payload: ['Folder deleted successfully'],
      });
    });

    // TODO: Add tests for branch workflow success handling when BE is ready
  });

  describe('Error Handling', () => {
    it('should handle error state and show error message', async () => {
      const error = new Error('API Error');
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      setup({
        requestState: {
          isError: true,
          error,
        },
      });

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Error deleting folder:', error);
        expect(mockPublish).toHaveBeenCalledWith({
          type: AppEvents.alertError.name,
          payload: ['Failed to delete folder', error],
        });
      });

      consoleSpy.mockRestore();
    });
  });
});
