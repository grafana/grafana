import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { getAppEvents } from '@grafana/runtime';
import { useGetFolderQuery } from 'app/api/clients/folder/v1beta1';
import {
  useCreateRepositoryFilesWithPathMutation,
  useCreateRepositoryJobsMutation,
  useGetRepositoryFilesWithPathQuery,
} from 'app/api/clients/provisioning/v0alpha1';
import { AnnoKeySourcePath } from 'app/features/apiserver/types';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { useProvisionedRequestHandler } from '../../hooks/useProvisionedRequestHandler';

import { MoveProvisionedDashboardForm, Props } from './MoveProvisionedDashboardForm';

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

jest.mock('../../hooks/useProvisionedRequestHandler', () => ({
  useProvisionedRequestHandler: jest.fn(),
}));

jest.mock('react-router-dom-v5-compat', () => ({
  useNavigate: () => jest.fn(),
}));

jest.mock('../Shared/ResourceEditFormSharedFields', () => ({
  ResourceEditFormSharedFields: () => <div data-testid="resource-edit-form" />,
}));

function setup(props: Partial<Props> = {}) {
  const user = userEvent.setup();

  const mockDashboard = {
    useState: jest.fn().mockReturnValue({
      editPanel: null,
    }),
    state: {
      title: 'Test Dashboard',
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
    workflowOptions: [
      { label: 'Write', value: 'write' },
      { label: 'Branch', value: 'branch' },
    ],
    targetFolderUID: 'target-folder-uid',
    targetFolderTitle: 'Target Folder',
    onDismiss: jest.fn(),
    onSuccess: jest.fn(),
    ...props,
  };

  return {
    user,
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

    (useProvisionedRequestHandler as jest.Mock).mockReturnValue(undefined);
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
});
