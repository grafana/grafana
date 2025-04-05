import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AppEvents } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';
import { useGetFolderQuery } from 'app/api/clients/folder';
import { useCreateRepositoryFilesWithPathMutation } from 'app/api/clients/provisioning';
import { validationSrv } from 'app/features/manage-dashboards/services/ValidationSrv';
import { useGetResourceRepositoryView } from 'app/features/provisioning/hooks/useGetResourceRepositoryView';
import { usePullRequestParam } from 'app/features/provisioning/hooks/usePullRequestParam';

import { FolderDTO } from '../../../types';

import { NewProvisionedFolderForm } from './NewProvisionedFolderForm';

jest.mock('@grafana/runtime', () => {
  const actual = jest.requireActual('@grafana/runtime');
  return {
    ...actual,
    getAppEvents: jest.fn(),
    locationService: {
      partial: jest.fn(),
    },
    config: {
      ...actual.config,
    },
  };
});

jest.mock('app/features/manage-dashboards/services/ValidationSrv', () => {
  return {
    validationSrv: {
      validateNewFolderName: jest.fn(),
    },
  };
});

jest.mock('app/api/clients/provisioning', () => {
  return {
    useCreateRepositoryFilesWithPathMutation: jest.fn(),
  };
});

jest.mock('app/api/clients/folder', () => {
  return {
    useGetFolderQuery: jest.fn(),
  };
});

jest.mock('app/features/provisioning/hooks/usePullRequestParam', () => {
  return {
    usePullRequestParam: jest.fn(),
  };
});

jest.mock('app/features/provisioning/hooks/useGetResourceRepositoryView', () => {
  return {
    useGetResourceRepositoryView: jest.fn(),
  };
});

jest.mock('react-router-dom-v5-compat', () => {
  const actual = jest.requireActual('react-router-dom-v5-compat');
  return {
    ...actual,
    useNavigate: () => jest.fn(),
  };
});

// Mock the defaults
jest.mock('../../dashboard-scene/saving/provisioned/defaults', () => {
  return {
    getDefaultWorkflow: jest.fn().mockReturnValue('write'),
    getWorkflowOptions: jest.fn().mockReturnValue([
      { label: 'Commit directly', value: 'write' },
      { label: 'Create a branch', value: 'branch' },
    ]),
  };
});

interface Props {
  onSubmit: () => void;
  onCancel: () => void;
  parentFolder: FolderDTO;
}

function setup(props: Partial<Props> = {}) {
  const user = userEvent.setup();

  const defaultProps: Props = {
    onSubmit: jest.fn(),
    onCancel: jest.fn(),
    parentFolder: {
      id: 1,
      uid: 'folder-uid',
      title: 'Parent Folder',
      url: '/dashboards/f/folder-uid',
      hasAcl: false,
      canSave: true,
      canEdit: true,
      canAdmin: true,
      canDelete: true,
      repository: {
        name: 'test-repo',
        type: 'github',
      },
    } as unknown as FolderDTO,
    ...props,
  };

  return {
    user,
    ...render(<NewProvisionedFolderForm {...defaultProps} />),
    props: defaultProps,
  };
}

const mockRequest = {
  isSuccess: false,
  isError: false,
  isLoading: false,
  error: null,
  data: { resource: { upsert: { metadata: { name: 'new-folder' } } } },
};

describe('NewProvisionedFolderForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mocks
    const mockAppEvents = {
      publish: jest.fn(),
    };
    (getAppEvents as jest.Mock).mockReturnValue(mockAppEvents);

    (useGetResourceRepositoryView as jest.Mock).mockReturnValue({
      isLoading: false,
      repository: {
        name: 'test-repo',
        title: 'Test Repository',
        type: 'github',
        github: {
          url: 'https://github.com/grafana/grafana',
          branch: 'main',
        },
        workflows: [{ name: 'default', path: 'workflows/default.json' }],
      },
    });

    // Mock useGetFolderQuery
    (useGetFolderQuery as jest.Mock).mockReturnValue({
      data: {
        metadata: {
          annotations: {
            'source.path': '/dashboards',
          },
        },
      },
      isLoading: false,
      isError: false,
    });

    // Mock usePullRequestParam
    (usePullRequestParam as jest.Mock).mockReturnValue(null);

    // Mock useCreateRepositoryFilesWithPathMutation
    const mockCreate = jest.fn();

    (useCreateRepositoryFilesWithPathMutation as jest.Mock).mockReturnValue([mockCreate, mockRequest]);

    (validationSrv.validateNewFolderName as jest.Mock).mockResolvedValue(true);
  });

  it('should render the form with correct fields', () => {
    setup();

    // Check if form elements are rendered
    expect(screen.getByRole('textbox', { name: /folder name/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /comment/i })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^create$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('should show loading state when repository data is loading', () => {
    (useGetResourceRepositoryView as jest.Mock).mockReturnValue({
      isLoading: true,
    });

    setup();

    expect(screen.getByTestId('Spinner')).toBeInTheDocument();
  });

  it('should show error when repository is not found', () => {
    (useGetResourceRepositoryView as jest.Mock).mockReturnValue({
      isLoading: false,
      repository: undefined,
    });

    setup();

    expect(screen.getByText('Repository not found')).toBeInTheDocument();
  });

  it('should show branch field when branch workflow is selected', async () => {
    const { user } = setup();

    expect(screen.queryByRole('textbox', { name: /branch/i })).not.toBeInTheDocument();

    const branchOption = screen.getByRole('radio', { name: /create a branch/i });
    await user.click(branchOption);

    expect(screen.getByRole('textbox', { name: /branch/i })).toBeInTheDocument();
  });

  it('should validate folder name', async () => {
    (validationSrv.validateNewFolderName as jest.Mock).mockRejectedValue(new Error('Folder name already exists'));

    const { user } = setup();

    const folderNameInput = screen.getByRole('textbox', { name: /folder name/i });
    await user.clear(folderNameInput);
    await user.type(folderNameInput, 'Existing Folder');

    // Submit the form
    const submitButton = screen.getByRole('button', { name: /^create$/i });
    await user.click(submitButton);

    // Wait for validation error to appear
    await waitFor(() => {
      expect(screen.getByText('Folder name already exists')).toBeInTheDocument();
    });
  });

  it('should validate branch name', async () => {
    const { user } = setup();

    // Select branch workflow
    const branchOption = screen.getByRole('radio', { name: /create a branch/i });
    await user.click(branchOption);

    // Enter invalid branch name
    const branchInput = screen.getByRole('textbox', { name: /branch/i });
    await user.clear(branchInput);
    await user.type(branchInput, 'invalid//branch');

    // Submit the form
    const submitButton = screen.getByRole('button', { name: /^create$/i });
    await user.click(submitButton);

    // Wait for validation error to appear
    await waitFor(() => {
      expect(screen.getByText('Invalid branch name.')).toBeInTheDocument();
    });
  });

  it('should create folder successfully', async () => {
    const mockCreate = jest.fn();
    (useCreateRepositoryFilesWithPathMutation as jest.Mock).mockReturnValue([
      mockCreate,
      {
        ...mockRequest,
        isSuccess: true,
        isError: false,
        isLoading: false,
        error: null,
      },
    ]);

    const { user, props } = setup();

    const folderNameInput = screen.getByRole('textbox', { name: /folder name/i });
    const commentInput = screen.getByRole('textbox', { name: /comment/i });

    await user.clear(folderNameInput);
    await user.type(folderNameInput, 'New Test Folder');

    await user.clear(commentInput);
    await user.type(commentInput, 'Creating a new test folder');

    // Submit the form
    const submitButton = screen.getByRole('button', { name: /^create$/i });
    await user.click(submitButton);

    // Check if create was called with correct parameters
    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          ref: undefined, // write workflow uses undefined ref
          name: 'test-repo',
          message: 'Creating a new test folder',
          body: {
            title: 'New Test Folder',
            type: 'folder',
          },
        })
      );
    });

    // Check if onSubmit was called
    expect(props.onSubmit).toHaveBeenCalled();
  });

  it('should create folder with branch workflow', async () => {
    const mockCreate = jest.fn();
    (useCreateRepositoryFilesWithPathMutation as jest.Mock).mockReturnValue([
      mockCreate,
      {
        ...mockRequest,
        isSuccess: true,
        isError: false,
        isLoading: false,
        error: null,
      },
    ]);

    const { user } = setup();

    // Fill form
    const folderNameInput = screen.getByRole('textbox', { name: /folder name/i });
    await user.clear(folderNameInput);
    await user.type(folderNameInput, 'Branch Folder');

    // Select branch workflow
    const branchOption = screen.getByRole('radio', { name: /create a branch/i });
    await user.click(branchOption);

    // Enter branch name
    const branchInput = screen.getByRole('textbox', { name: /branch/i });
    await user.clear(branchInput);
    await user.type(branchInput, 'feature/new-folder');

    // Submit the form
    const submitButton = screen.getByRole('button', { name: /^create$/i });
    await user.click(submitButton);

    // Check if create was called with correct parameters
    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          ref: 'feature/new-folder',
          name: 'test-repo',
          message: 'Create folder: Branch Folder',
          body: {
            title: 'Branch Folder',
            type: 'folder',
          },
        })
      );
    });
  });

  it('should show error when folder creation fails', async () => {
    const mockCreate = jest.fn();
    (useCreateRepositoryFilesWithPathMutation as jest.Mock).mockReturnValue([
      mockCreate,
      {
        ...mockRequest,
        isSuccess: false,
        isError: true,
        isLoading: false,
        error: 'Failed to create folder',
      },
    ]);

    const { user } = setup();

    // Fill form
    const folderNameInput = screen.getByRole('textbox', { name: /folder name/i });
    await user.clear(folderNameInput);
    await user.type(folderNameInput, 'Error Folder');

    // Submit the form
    const submitButton = screen.getByRole('button', { name: /^create$/i });
    await user.click(submitButton);

    // Check if error alert was published
    await waitFor(() => {
      const appEvents = getAppEvents();
      expect(appEvents.publish).toHaveBeenCalledWith({
        type: AppEvents.alertError.name,
        payload: ['Error creating folder', 'Failed to create folder'],
      });
    });
  });

  it('should disable create button when form is submitting', async () => {
    (useCreateRepositoryFilesWithPathMutation as jest.Mock).mockReturnValue([
      jest.fn(),
      {
        ...mockRequest,
        isSuccess: false,
        isError: false,
        isLoading: true,
        error: null,
      },
    ]);

    setup();

    // Create button should be disabled and show loading text
    const createButton = screen.getByRole('button', { name: /creating/i });
    expect(createButton).toBeDisabled();
    expect(createButton).toHaveTextContent('Creating...');
  });

  it('should show PR link when PR URL is available', () => {
    (usePullRequestParam as jest.Mock).mockReturnValue('https://github.com/grafana/grafana/pull/1234');

    setup();

    // PR alert should be visible - use text content instead of role
    expect(screen.getByText('Pull request created')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveTextContent('https://github.com/grafana/grafana/pull/1234');
  });

  it('should call onCancel when cancel button is clicked', async () => {
    const { user, props } = setup();

    // Click cancel button
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    // Check if onCancel was called
    expect(props.onCancel).toHaveBeenCalled();
  });

  it('should show read-only alert when repository has no workflows', () => {
    // Mock repository with empty workflows array
    (useGetResourceRepositoryView as jest.Mock).mockReturnValue({
      repository: {
        name: 'test-repo',
        title: 'Test Repository',
        type: 'github',
        github: {
          url: 'https://github.com/grafana/grafana',
          branch: 'main',
        },
        workflows: [],
      },
    });

    setup();

    // Read-only alert should be visible
    expect(screen.getByText('This repository is read only')).toBeInTheDocument();
  });
});
