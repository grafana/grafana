import { render, screen, waitFor } from 'test/test-utils';

import { AppEvents } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';
import { useGetFolderQuery } from 'app/api/clients/folder/v1beta1';
import {
  useCreateRepositoryFilesWithPathMutation,
  useCreateRepositoryJobsMutation,
  useGetRepositoryFilesWithPathQuery,
} from 'app/api/clients/provisioning/v0alpha1';
import { AnnoKeySourcePath } from 'app/features/apiserver/types';
import { type DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { MoveProvisionedDashboardForm, type Props } from './MoveProvisionedDashboardForm';

jest.mock('@grafana/runtime', () => {
  const actual = jest.requireActual('@grafana/runtime');
  return {
    ...actual,
    getAppEvents: jest.fn(),
  };
});

jest.mock('app/api/clients/provisioning/v0alpha1', () => ({
  useGetRepositoryFilesWithPathQuery: jest.fn(),
  useCreateRepositoryFilesWithPathMutation: jest.fn(),
  useCreateRepositoryJobsMutation: jest.fn(),
  provisioningAPIv0alpha1: {
    endpoints: {
      listRepository: {
        select: jest.fn(() => () => ({ data: { items: [] } })),
      },
    },
  },
}));

jest.mock('app/api/clients/folder/v1beta1', () => ({
  useGetFolderQuery: jest.fn(),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom-v5-compat', () => ({
  ...jest.requireActual('react-router-dom-v5-compat'),
  useNavigate: () => mockNavigate,
}));

jest.mock('../Shared/ResourceEditFormSharedFields', () => ({
  ResourceEditFormSharedFields: () => <div data-testid="resource-edit-form" />,
}));

function setup(props: Partial<Props> = {}) {
  const mockDashboard = {
    useState: jest.fn().mockReturnValue({
      editPanel: null,
    }),
    setState: jest.fn(),
    state: {
      title: 'Test Dashboard',
      meta: {
        uid: 'dashboard-uid',
      },
    },
  } as unknown as DashboardScene;

  const defaultProps: Props = {
    dashboard: mockDashboard,
    defaultValues: {
      repo: 'test-repo',
      path: 'folder1/dashboard.json',
      ref: 'main',
      workflow: 'write',
      comment: '',
      title: 'Test Dashboard',
      description: '',
      folder: { uid: '', title: '' },
    },
    readOnly: false,
    repository: {
      type: 'github',
      name: 'test-repo',
      title: 'Test Repo',
      workflows: ['branch', 'write'],
      target: 'folder',
    },
    canPushToConfiguredBranch: true,
    targetFolderUID: 'target-folder-uid',
    targetFolderTitle: 'Target Folder',
    onDismiss: jest.fn(),
    onSuccess: jest.fn(),
    ...props,
  };

  return {
    ...render(<MoveProvisionedDashboardForm {...defaultProps} />),
    props: defaultProps,
  };
}

const mockCreateRequest = {
  isSuccess: false,
  isError: false,
  isLoading: false,
  error: null,
};

const branchDefaultValues: Props['defaultValues'] = {
  repo: 'test-repo',
  path: 'folder1/dashboard.json',
  ref: 'feature/move',
  workflow: 'branch',
  comment: '',
  title: 'Test Dashboard',
  description: '',
  folder: { uid: '', title: '' },
};

describe('MoveProvisionedDashboardForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mocks
    const mockAppEvents = {
      publish: jest.fn(),
    };
    (getAppEvents as jest.Mock).mockReturnValue(mockAppEvents);

    // Mock hooks
    (useGetRepositoryFilesWithPathQuery as jest.Mock).mockReturnValue({
      data: {
        resource: {
          file: { spec: { title: 'Test Dashboard' } },
          dryRun: {
            metadata: {
              annotations: {
                [AnnoKeySourcePath]: 'folder1/dashboard.json',
              },
            },
          },
        },
      },
      isLoading: false,
    });

    (useGetFolderQuery as jest.Mock).mockReturnValue({
      data: {
        metadata: {
          annotations: {
            [AnnoKeySourcePath]: 'target-folder',
          },
        },
      },
      isLoading: false,
    });

    (useCreateRepositoryFilesWithPathMutation as jest.Mock).mockReturnValue([jest.fn(), mockCreateRequest]);
    (useCreateRepositoryJobsMutation as jest.Mock).mockReturnValue([jest.fn(), mockCreateRequest]);
  });

  it('should render the form with correct title and subtitle', () => {
    setup();

    expect(screen.getByText('Move Provisioned Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Test Dashboard')).toBeInTheDocument();
  });

  it('should render form even when currentFileData is not available', () => {
    (useGetRepositoryFilesWithPathQuery as jest.Mock).mockReturnValue({
      data: null,
      isLoading: false,
    });

    setup();

    // Form should still render, but move button should be disabled
    expect(screen.getByText('Move Provisioned Dashboard')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /move dashboard/i })).toBeDisabled();
  });

  it('should show loading spinner when file data is loading', () => {
    (useGetRepositoryFilesWithPathQuery as jest.Mock).mockReturnValue({
      data: null,
      isLoading: true,
    });

    setup();

    expect(screen.getByText('Loading dashboard data')).toBeInTheDocument();
  });

  it('should show read-only alert when repository is read-only', () => {
    setup({ readOnly: true });

    expect(screen.getByText('This repository is read only')).toBeInTheDocument();
    expect(screen.getByText(/This dashboard cannot be moved directly from Grafana/)).toBeInTheDocument();
  });

  it('should show target path input with calculated path', () => {
    setup();

    expect(screen.getByDisplayValue('target-folder/dashboard.json')).toBeInTheDocument();
  });

  it('should show error alert when file data has errors', () => {
    (useGetRepositoryFilesWithPathQuery as jest.Mock).mockReturnValue({
      data: {
        errors: ['File not found', 'Permission denied'],
        resource: null,
      },
      isLoading: false,
    });

    setup();

    expect(screen.getByText('Error loading dashboard')).toBeInTheDocument();
    expect(screen.getByText('File not found')).toBeInTheDocument();
    expect(screen.getByText('Permission denied')).toBeInTheDocument();
  });

  it('should disable move button when form is submitting', () => {
    (useCreateRepositoryFilesWithPathMutation as jest.Mock).mockReturnValue([
      jest.fn(),
      {
        ...mockCreateRequest,
        isLoading: true,
      },
    ]);

    setup();

    const moveButton = screen.getByRole('button', { name: /moving/i });
    expect(moveButton).toBeDisabled();
    expect(moveButton).toHaveTextContent('Moving...');
  });

  it('should show move dashboard button when not loading', () => {
    setup();

    expect(screen.getByRole('button', { name: /move dashboard/i })).toBeInTheDocument();
  });

  it('should call onDismiss when cancel button is clicked', async () => {
    const { user, props } = setup();

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(props.onDismiss).toHaveBeenCalled();
  });

  it('does not submit a move job when the dashboard is already at the target path', async () => {
    const createJob = jest.fn();
    (useCreateRepositoryJobsMutation as jest.Mock).mockReturnValue([createJob, mockCreateRequest]);
    (useGetFolderQuery as jest.Mock).mockReturnValue({
      data: {
        metadata: {
          annotations: {
            [AnnoKeySourcePath]: 'folder1',
          },
        },
      },
      isLoading: false,
    });

    const { user } = setup();

    await user.click(screen.getByRole('button', { name: /move dashboard/i }));

    expect(createJob).not.toHaveBeenCalled();
    expect(getAppEvents().publish).toHaveBeenCalledWith({
      type: AppEvents.alertError.name,
      payload: ['Failed to move dashboard', 'Dashboard is already in the selected folder.'],
    });
  });

  it('renders the message from the repo commit template when comment is empty', async () => {
    const moveFile = jest.fn().mockReturnValue({ unwrap: jest.fn().mockResolvedValue({ resource: {} }) });
    (useCreateRepositoryFilesWithPathMutation as jest.Mock).mockReturnValue([moveFile, mockCreateRequest]);
    // upstream isResourceAlreadyInTarget guard requires currentSourcePath !== targetFolderPath
    (useGetFolderQuery as jest.Mock).mockReturnValue({
      data: { metadata: { annotations: { [AnnoKeySourcePath]: 'target-folder' } } },
      isLoading: false,
    });

    const { user } = setup({
      defaultValues: branchDefaultValues,
      repository: {
        type: 'github',
        name: 'test-repo',
        title: 'Test Repo',
        workflows: ['branch', 'write'],
        target: 'folder',
        commit: { singleResourceMessageTemplate: 'chore({{resourceKind}}s): {{action}} {{title}}' },
      },
    });

    await user.click(screen.getByRole('button', { name: /move dashboard/i }));

    expect(moveFile).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'chore(dashboards): move Test Dashboard' })
    );
  });

  it('navigates to the PR redirect URL and dismisses the drawer on branch workflow success', async () => {
    const moveFile = jest.fn().mockReturnValue({
      unwrap: jest.fn().mockResolvedValue({
        ref: 'feature/move',
        path: 'target-folder/dashboard.json',
        urls: { newPullRequestURL: 'https://github.com/test/repo/compare/main...feature/move' },
        resource: {
          upsert: {
            apiVersion: 'v1',
            kind: 'Dashboard',
            metadata: { name: 'dashboard-uid', uid: 'dashboard-uid' },
            spec: { title: 'Test Dashboard' },
          },
        },
      }),
    });
    (useCreateRepositoryFilesWithPathMutation as jest.Mock).mockReturnValue([moveFile, mockCreateRequest]);

    const { user, props } = setup({ defaultValues: branchDefaultValues });

    await user.click(screen.getByRole('button', { name: /move dashboard/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        '/dashboards?new_pull_request_url=https%3A%2F%2Fgithub.com%2Ftest%2Frepo%2Fcompare%2Fmain...feature%2Fmove&repo_type=github'
      );
    });
    expect(props.dashboard.setState).toHaveBeenCalledWith({ isDirty: false });
    expect(props.onDismiss).toHaveBeenCalled();
  });

  it('publishes a single error alert when the branch workflow move fails', async () => {
    const moveFile = jest.fn().mockReturnValue({
      unwrap: jest.fn().mockRejectedValue(new Error('merge conflict')),
    });
    (useCreateRepositoryFilesWithPathMutation as jest.Mock).mockReturnValue([moveFile, mockCreateRequest]);

    const { user, props } = setup({ defaultValues: branchDefaultValues });

    await user.click(screen.getByRole('button', { name: /move dashboard/i }));

    await waitFor(() => {
      expect(getAppEvents().publish).toHaveBeenCalledWith({
        type: AppEvents.alertError.name,
        payload: ['Failed to move dashboard', expect.any(Error)],
      });
    });
    // The hook-level onError handler was removed — the form's own catch is the only error surface
    expect(getAppEvents().publish).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(props.onDismiss).not.toHaveBeenCalled();
  });
});
