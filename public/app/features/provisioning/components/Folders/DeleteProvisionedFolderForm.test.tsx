import { OpenFeatureProvider } from '@openfeature/react-sdk';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';

import { getTestFeatureFlagClient } from '@grafana/test-utils/unstable';
import { type RepositoryView, useCreateRepositoryJobsMutation } from 'app/api/clients/provisioning/v0alpha1';
import { type StepStatusInfo } from 'app/features/provisioning/Wizard/types';
import { type FolderDTO } from 'app/types/folders';

import {
  type ProvisionedFolderFormDataResult,
  useProvisionedFolderFormData,
} from '../../hooks/useProvisionedFolderFormData';

import { DeleteProvisionedFolderForm } from './DeleteProvisionedFolderForm';

// Mock dependencies
const mockNavigate = jest.fn();
jest.mock('react-router-dom-v5-compat', () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock('react-redux', () => {
  const actual = jest.requireActual('react-redux');
  return {
    ...actual,
    useDispatch: jest.fn,
  };
});

jest.mock('app/api/clients/provisioning/v0alpha1', () => ({
  useCreateRepositoryJobsMutation: jest.fn(),
  useGetRepositoryRefsQuery: jest.fn(() => ({
    data: { items: [{ name: 'main' }, { name: 'develop' }] },
    isLoading: false,
  })),
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

jest.mock('../../hooks/useGetResourceRepositoryView', () => ({
  ...jest.requireActual('../../hooks/useGetResourceRepositoryView'),
  useGetResourceRepositoryView: jest.fn(),
}));

jest.mock('app/features/browse-dashboards/components/BrowseActions/AffectedFolderContents', () => ({
  AffectedFolderContents: jest.fn(({ defaultMessage }) => (
    <div data-testid="affected-folder-contents">{defaultMessage}</div>
  )),
}));

jest.mock('../Shared/ResourceEditFormSharedFields', () => ({
  ResourceEditFormSharedFields: () => <div data-testid="shared-fields" />,
}));

// The job watcher reports whatever status a test queues up, in place of polling the API.
let mockJobStatusInfo: StepStatusInfo = { status: 'running' };
jest.mock('app/features/provisioning/Job/JobStatus', () => ({
  JobStatus: ({ onStatusChange }: { onStatusChange?: (info: StepStatusInfo) => void }) => {
    useEffect(() => {
      onStatusChange?.(mockJobStatusInfo);
    }, [onStatusChange]);
    return <div data-testid="job-status" />;
  },
}));

const mockUseCreateRepositoryJobsMutation = useCreateRepositoryJobsMutation as jest.MockedFunction<
  typeof useCreateRepositoryJobsMutation
>;
const mockUseProvisionedFolderFormData = useProvisionedFolderFormData as jest.MockedFunction<
  typeof useProvisionedFolderFormData
>;

const mockCreateJob = jest.fn();

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
  branch: 'main',
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
  comment: '',
  title: 'Test Folder',
};

const defaultHookData: ProvisionedFolderFormDataResult = {
  repository: mockRepository,
  folder: mockFolder,
  initialValues: mockFormData,
  isReadOnlyRepo: false,
  isMissingRepo: false,
  canPushToConfiguredBranch: true,
  isLoading: false,
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
  const mockJobMutationResult = [mockCreateJob, requestState] as unknown as ReturnType<
    typeof useCreateRepositoryJobsMutation
  >;
  const mockHookResult = hookData as ReturnType<typeof useProvisionedFolderFormData>;

  // The submit path awaits createJob(...).unwrap() and hands the job to the job watcher
  mockCreateJob.mockReturnValue({ unwrap: () => Promise.resolve({ metadata: { name: 'job-1' } }) });
  mockUseCreateRepositoryJobsMutation.mockReturnValue(mockJobMutationResult);
  mockUseProvisionedFolderFormData.mockReturnValue(mockHookResult);

  const onDismiss = jest.fn();
  const defaultProps = {
    parentFolder: mockParentFolder,
    onDismiss,
  };

  const renderResult = render(
    <OpenFeatureProvider client={getTestFeatureFlagClient()}>
      <DeleteProvisionedFolderForm {...defaultProps} {...props} />
    </OpenFeatureProvider>
  );

  const clickDeleteButton = async () => {
    const deleteButton = screen.getByRole('button', { name: /delete/i });
    await userEvent.click(deleteButton);
  };

  return {
    ...renderResult,
    onDismiss,
    mockCreateJob,
    mockNavigate,
    clickDeleteButton,
  };
}

describe('DeleteProvisionedFolderForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNavigate.mockClear();
    mockJobStatusInfo = { status: 'running' };
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('rendering', () => {
    it('should render component correctly ', () => {
      setup();
      // delete warning and descendant count
      expect(screen.getByText(/This will delete this folder and all its descendants/)).toBeInTheDocument();
      expect(screen.getByTestId('affected-folder-contents')).toBeInTheDocument();

      // delete and cancel buttons
      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('should not render the form when the repository is missing', () => {
      setup({}, { ...defaultHookData, repository: undefined, initialValues: undefined, isMissingRepo: true });
      expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    });
  });

  describe('form submission', () => {
    it('should call createJob with correct parameters when deleting on the configured branch', async () => {
      const { mockCreateJob, clickDeleteButton } = setup();

      await clickDeleteButton();

      await waitFor(() => {
        expect(mockCreateJob).toHaveBeenCalledWith({
          name: 'test-repo',
          jobSpec: {
            action: 'delete',
            message: 'Delete folder: Test Folder',
            delete: {
              ref: undefined, // the configured branch omits ref
              resources: [
                {
                  name: 'folder-uid',
                  group: 'folder.grafana.app',
                  kind: 'Folder',
                },
              ],
            },
          },
        });
      });
    });

    it('commits the rendered commit template on the configured branch', async () => {
      const { mockCreateJob, clickDeleteButton } = setup(
        {},
        {
          ...defaultHookData,
          repository: {
            ...mockRepository,
            commit: { singleResourceMessageTemplate: 'chore({{resourceKind}}s): {{action}} {{title}}' },
          },
        }
      );

      await clickDeleteButton();

      await waitFor(() => {
        expect(mockCreateJob).toHaveBeenCalledWith(
          expect.objectContaining({
            jobSpec: expect.objectContaining({ message: 'chore(folders): delete Test Folder' }),
          })
        );
      });
    });

    it('sends the custom commit message and the ref when deleting on a new branch', async () => {
      const customFormData = {
        ...mockFormData,
        ref: 'feature-branch',
        comment: 'Custom delete message',
      };
      const { mockCreateJob, clickDeleteButton } = setup({}, { ...defaultHookData, initialValues: customFormData });

      await clickDeleteButton();

      await waitFor(() => {
        expect(mockCreateJob).toHaveBeenCalledWith(
          expect.objectContaining({
            jobSpec: expect.objectContaining({
              message: 'Custom delete message',
              delete: expect.objectContaining({ ref: 'feature-branch' }),
            }),
          })
        );
      });
    });

    it('renders the message from the repo commit template when comment is empty', async () => {
      const { mockCreateJob, clickDeleteButton } = setup(
        {},
        {
          ...defaultHookData,
          repository: {
            ...defaultHookData.repository!,
            commit: { singleResourceMessageTemplate: 'chore({{resourceKind}}s): {{action}} {{title}}' },
          },
          initialValues: { ...mockFormData, ref: 'feature-branch', comment: '' },
        }
      );

      await clickDeleteButton();

      await waitFor(() => {
        expect(mockCreateJob).toHaveBeenCalledWith(
          expect.objectContaining({
            jobSpec: expect.objectContaining({ message: 'chore(folders): delete Test Folder' }),
          })
        );
      });
    });

    it('runs the delete job with the ref for an existing non-configured branch', async () => {
      const { mockCreateJob, clickDeleteButton } = setup(
        {},
        { ...defaultHookData, initialValues: { ...mockFormData, ref: 'develop' } }
      );

      await clickDeleteButton();

      await waitFor(() => {
        expect(mockCreateJob).toHaveBeenCalledWith(
          expect.objectContaining({
            jobSpec: expect.objectContaining({ delete: expect.objectContaining({ ref: 'develop' }) }),
          })
        );
      });
    });

    it('should not submit if repository name is missing', async () => {
      const { mockCreateJob, clickDeleteButton } = setup({}, { ...defaultHookData, repository: undefined });

      await clickDeleteButton();

      await waitFor(() => {
        expect(mockCreateJob).not.toHaveBeenCalled();
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
    it('redirects to the dashboard list with the PR link once a branch delete job finishes', async () => {
      mockJobStatusInfo = { status: 'success', urls: { newPullRequestURL: 'https://github.com/test/repo/pull/new' } };
      const { mockNavigate, onDismiss, clickDeleteButton } = setup(
        {},
        { ...defaultHookData, initialValues: { ...mockFormData, ref: 'feature-branch' } }
      );

      await clickDeleteButton();

      await waitFor(() => {
        const expectedParams = new URLSearchParams();
        expectedParams.set('new_pull_request_url', 'https://github.com/test/repo/pull/new');
        expectedParams.set('repo_type', 'git');
        expectedParams.set('action', 'delete');
        const expectedUrl = `/dashboards?${expectedParams.toString()}`;

        expect(mockNavigate).toHaveBeenCalledWith(expectedUrl);
      });
      expect(onDismiss).toHaveBeenCalled();
    });

    it('redirects to the dashboard list once a configured-branch delete job finishes', async () => {
      mockJobStatusInfo = { status: 'success' };
      const { mockNavigate, onDismiss, clickDeleteButton } = setup();

      await clickDeleteButton();

      await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboards'));
      expect(onDismiss).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should show the API error in an alert when the job cannot be created', async () => {
      const { onDismiss, clickDeleteButton } = setup(
        {},
        { ...defaultHookData, initialValues: { ...mockFormData, ref: 'feature-branch' } }
      );
      mockCreateJob.mockReturnValue({
        unwrap: () => Promise.reject({ status: 500, data: { message: 'API Error' } }),
      });

      await clickDeleteButton();

      // The form catches the error and surfaces it in an alert; it stays open
      expect(await screen.findByText('API Error')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
      expect(onDismiss).not.toHaveBeenCalled();
    });
  });
});
