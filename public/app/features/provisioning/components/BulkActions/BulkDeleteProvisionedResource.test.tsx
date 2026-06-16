import { screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { render } from 'test/test-utils';

import { type Job, type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { JobStatus } from 'app/features/provisioning/Job/JobStatus';

import { useSelectionRepoValidation } from '../../hooks/useSelectionRepoValidation';

import { BulkDeleteProvisionedResource } from './BulkDeleteProvisionedResource';
import { type ResponseType } from './useBulkActionJob';

jest.mock('app/features/browse-dashboards/components/BrowseActions/AffectedFolderContents', () => ({
  AffectedFolderContents: jest.fn(({ selectedItems, defaultMessage }) => (
    <div data-testid="affected-folder-contents">
      {defaultMessage}
      Mocked affected folder contents for {Object.keys(selectedItems.folder).length} folders and{' '}
      {Object.keys(selectedItems.dashboard).length} dashboards
    </div>
  )),
}));

jest.mock('app/features/provisioning/hooks/useGetResourceRepositoryView', () => ({
  ...jest.requireActual('app/features/provisioning/hooks/useGetResourceRepositoryView'),
  useGetResourceRepositoryView: jest.fn(),
}));

jest.mock('../../hooks/useSelectionRepoValidation', () => ({
  useSelectionRepoValidation: jest.fn(),
}));

const mockUseSelectionRepoValidation = useSelectionRepoValidation as jest.MockedFunction<
  typeof useSelectionRepoValidation
>;

jest.mock('./useBulkActionJob', () => ({
  useBulkActionJob: jest.fn(),
}));

jest.mock('app/features/provisioning/Job/JobStatus', () => ({
  JobStatus: jest.fn(({ watch, jobType }) => (
    <div data-testid="job-status">
      Job Status - {jobType} - {watch?.status?.state || 'pending'}
    </div>
  )),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getAppEvents: jest.fn(() => ({
    publish: jest.fn(),
  })),
}));

const mockUseGetResourceRepositoryView = jest.mocked(
  require('app/features/provisioning/hooks/useGetResourceRepositoryView').useGetResourceRepositoryView
);
const mockUseBulkActionJob = jest.mocked(require('./useBulkActionJob').useBulkActionJob);
const mockGetAppEvents = jest.mocked(require('@grafana/runtime').getAppEvents);
const mockJobStatus = jest.mocked(JobStatus);

// jest.clearAllMocks() clears call history but not a custom mockImplementation, so a per-test
// override of JobStatus would leak; restore the default in beforeEach.
function resetJobStatusMock() {
  mockJobStatus.mockImplementation(({ watch, jobType }) => (
    <div data-testid="job-status">
      Job Status - {jobType} - {watch?.status?.state || 'pending'}
    </div>
  ));
}

function setup(
  repository: RepositoryView | null,
  mockJobResult: ResponseType = {
    success: true,
    job: { metadata: { name: 'test-job' }, status: { state: 'success' } },
  },
  isLoading = false
) {
  const selectedItems = {
    folder: { 'folder-1': true },
    dashboard: { 'dashboard-1': true },
  };

  const defaultRepository: RepositoryView = {
    name: 'test-folder',
    type: 'github',
    title: 'Test Repository',
    target: 'folder',
    workflows: ['branch', 'write'],
  };

  const onDismiss = jest.fn();
  const mockCreateBulkJob = jest.fn().mockResolvedValue(mockJobResult);

  mockUseGetResourceRepositoryView.mockReturnValue({
    repository: repository ?? defaultRepository,
    folder: repository
      ? {
          metadata: {
            annotations: {
              'grafana.app/file-path': '/test/folder',
            },
          },
        }
      : null,
    isInstanceManaged: false,
    isMissingRepo: false,
  });

  mockUseBulkActionJob.mockReturnValue({
    createBulkJob: mockCreateBulkJob,
    isLoading,
  });

  const renderResult = render(
    <BulkDeleteProvisionedResource folderUid="test-folder" selectedItems={selectedItems} onDismiss={onDismiss} />
  );

  return {
    onDismiss,
    mockCreateBulkJob,
    selectedItems,
    defaultRepository,
    ...renderResult,
  };
}

describe('BulkDeleteProvisionedResource', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetJobStatusMock();

    mockUseSelectionRepoValidation.mockReturnValue({
      selectedItemsRepoUID: 'test-folder',
      isInLockedRepo: jest.fn().mockReturnValue(false),
      isCrossRepo: false,
      isUidInReadOnlyRepo: jest.fn().mockReturnValue(false),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the delete warning and form', async () => {
    setup(null);

    expect(await screen.findByText(/This will delete selected folders and their descendants/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Delete/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
  });

  it('shows a spinner while repository data is loading', async () => {
    mockUseGetResourceRepositoryView.mockReturnValue({
      repository: undefined,
      folder: null,
      isInstanceManaged: false,
      isReadOnlyRepo: false,
      isMissingRepo: false,
      isLoading: true,
    });
    mockUseBulkActionJob.mockReturnValue({ createBulkJob: jest.fn(), isLoading: false });

    render(
      <BulkDeleteProvisionedResource
        folderUid="test-folder"
        selectedItems={{ folder: { 'folder-1': true }, dashboard: {} }}
        onDismiss={jest.fn()}
      />
    );

    expect(await screen.findByTestId('Spinner')).toBeInTheDocument();
    expect(screen.queryByText(/Repository not found/)).not.toBeInTheDocument();
  });

  it('shows RepoInvalidStateBanner when repository is not found', async () => {
    mockUseGetResourceRepositoryView.mockReturnValue({
      repository: undefined,
      folder: null,
      isInstanceManaged: false,
      isReadOnlyRepo: false,
      isMissingRepo: true,
    });
    mockUseBulkActionJob.mockReturnValue({ createBulkJob: jest.fn(), isLoading: false });

    render(
      <BulkDeleteProvisionedResource
        folderUid="test-folder"
        selectedItems={{ folder: { 'folder-1': true }, dashboard: {} }}
        onDismiss={jest.fn()}
      />
    );

    expect(await screen.findByText(/Repository not found/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Delete/i })).not.toBeInTheDocument();
  });

  it('calls onDismiss when Cancel is clicked', async () => {
    const { onDismiss, user } = setup(null);

    await user.click(screen.getByRole('button', { name: /Cancel/i }));

    expect(onDismiss).toHaveBeenCalled();
  });

  it('handles successful deletion', async () => {
    const { user, mockCreateBulkJob, defaultRepository } = setup(null);

    await user.click(screen.getByRole('button', { name: /Delete/i }));

    expect(mockCreateBulkJob).toHaveBeenCalledWith(
      defaultRepository,
      expect.objectContaining({
        action: 'delete',
        message: expect.stringContaining('Delete resources'),
        delete: expect.objectContaining({
          resources: expect.arrayContaining([
            expect.objectContaining({ name: 'folder-1', kind: 'Folder' }),
            expect.objectContaining({ name: 'dashboard-1', kind: 'Dashboard' }),
          ]),
        }),
      })
    );

    // Should show JobStatus component
    expect(await screen.findByTestId('job-status')).toBeInTheDocument();
    expect(screen.getByText(/Job Status - delete - success/)).toBeInTheDocument();
  });

  it('handles deletion errors', async () => {
    const mockPublish = jest.fn();
    const { user } = setup(null, { success: false, error: 'Network error' });

    mockGetAppEvents.mockReturnValue({
      publish: mockPublish,
    });

    await user.click(screen.getByRole('button', { name: /Delete/i }));

    // Should remain on form (not show JobStatus) when there's an error
    expect(screen.queryByTestId('job-status')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Delete/i })).toBeInTheDocument();

    expect(mockPublish).toHaveBeenCalledWith({
      type: 'alert-error',
      payload: ['Error deleting resources', 'Network error'],
    });
  });

  it('shows loading state during deletion', async () => {
    const workingJob: Job = { metadata: { name: 'test-job' }, status: { state: 'working' } };
    const { user } = setup(null, { success: true, job: workingJob });

    await user.click(screen.getByRole('button', { name: /Delete/i }));

    // After click, should show JobStatus
    await waitFor(() => {
      expect(screen.getByTestId('job-status')).toBeInTheDocument();
    });

    expect(screen.getByText(/Job Status - delete - working/)).toBeInTheDocument();
  });

  it('Should not show buttons when job is in working state', async () => {
    const workingJob: Job = { metadata: { name: 'test-job' }, status: { state: 'working' } };
    const { user } = setup(null, { success: true, job: workingJob });

    await user.click(screen.getByRole('button', { name: /Delete/i }));

    // Should show JobStatus after submission
    expect(await screen.findByTestId('job-status')).toBeInTheDocument();

    // Done button should not be disabled
    const deleteButton = screen.queryByRole('button', { name: /Delete/i });
    expect(deleteButton).not.toBeInTheDocument();
  });

  it('calls createBulkJob with branch workflow parameters by default', async () => {
    const { user, mockCreateBulkJob, defaultRepository } = setup(null);

    await user.click(screen.getByRole('button', { name: /Delete/i }));

    expect(mockCreateBulkJob).toHaveBeenCalledWith(
      defaultRepository,
      expect.objectContaining({
        action: 'delete',
        delete: expect.objectContaining({
          ref: expect.stringContaining('bulk-delete/'),
        }),
      })
    );
  });

  it('preserves repository context when selection clears on root page', async () => {
    const selectedItems = {
      folder: { 'folder-1': true },
      dashboard: { 'dashboard-1': true },
    };

    const defaultRepository: RepositoryView = {
      name: 'test-folder',
      type: 'github',
      title: 'Test Repository',
      target: 'folder',
      workflows: ['branch', 'write'],
    };

    const mockCreateBulkJob = jest.fn().mockResolvedValue({
      success: true,
      job: { metadata: { name: 'test-job' }, status: { state: 'success' } },
    });

    mockUseGetResourceRepositoryView.mockImplementation(({ folderName }: { folderName?: string }) => {
      if (folderName === 'test-folder') {
        return {
          repository: defaultRepository,
          folder: null,
          isInstanceManaged: false,
          isReadOnlyRepo: false,
          isMissingRepo: false,
        };
      }
      return {
        repository: undefined,
        folder: null,
        isInstanceManaged: false,
        isReadOnlyRepo: false,
        isMissingRepo: true,
      };
    });

    mockUseBulkActionJob.mockReturnValue({
      createBulkJob: mockCreateBulkJob,
      isLoading: false,
    });

    const onDismiss = jest.fn();
    const { rerender, user } = render(
      <BulkDeleteProvisionedResource folderUid={undefined} selectedItems={selectedItems} onDismiss={onDismiss} />
    );

    await user.click(screen.getByRole('button', { name: /Delete/i }));
    expect(await screen.findByTestId('job-status')).toBeInTheDocument();

    // Simulate selection clearing after job starts
    mockUseSelectionRepoValidation.mockReturnValue({
      selectedItemsRepoUID: undefined,
      isInLockedRepo: jest.fn().mockReturnValue(false),
      isCrossRepo: false,
      isUidInReadOnlyRepo: jest.fn().mockReturnValue(false),
    });

    rerender(
      <BulkDeleteProvisionedResource folderUid={undefined} selectedItems={selectedItems} onDismiss={onDismiss} />
    );

    // The ref should preserve the repo UID, so the job status remains visible
    expect(screen.getByTestId('job-status')).toBeInTheDocument();
    expect(screen.queryByText(/Repository not found/)).not.toBeInTheDocument();
  });

  it('calls createBulkJob with write workflow parameters for write-only repositories', async () => {
    const writeOnlyRepository: RepositoryView = {
      name: 'test-folder',
      type: 'github',
      title: 'Test Repository',
      target: 'folder',
      workflows: ['write'],
    };
    const { user, mockCreateBulkJob } = setup(writeOnlyRepository);

    await user.click(screen.getByRole('button', { name: /Delete/i }));

    expect(mockCreateBulkJob).toHaveBeenCalledWith(
      writeOnlyRepository,
      expect.objectContaining({
        action: 'delete',
        delete: expect.objectContaining({
          ref: undefined,
          resources: expect.arrayContaining([
            expect.objectContaining({ name: 'folder-1', kind: 'Folder' }),
            expect.objectContaining({ name: 'dashboard-1', kind: 'Dashboard' }),
          ]),
        }),
      })
    );
  });

  it('does not show a generated branch and targets the configured branch when write is the default workflow', async () => {
    const writeFirstRepository: RepositoryView = {
      name: 'test-folder',
      type: 'github',
      title: 'Test Repository',
      target: 'folder',
      branch: 'main',
      workflows: ['write', 'branch'],
    };
    const { user, mockCreateBulkJob } = setup(writeFirstRepository);

    // Wait for the real ResourceEditFormSharedFields branch field to render.
    await screen.findByRole('button', { name: /Delete/i });

    // The pre-filled branch must match the job (configured branch), not a generated bulk-delete branch.
    expect(screen.queryByText(/bulk-delete\//)).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue(/bulk-delete\//)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Delete/i }));

    expect(mockCreateBulkJob).toHaveBeenCalledWith(
      writeFirstRepository,
      expect.objectContaining({
        action: 'delete',
        delete: expect.objectContaining({
          ref: undefined,
        }),
      })
    );
  });

  it('shows the branch success message when the job completes on the branch workflow', async () => {
    mockJobStatus.mockImplementation(({ onStatusChange }) => {
      useEffect(() => {
        onStatusChange?.({ status: 'success' });
      }, [onStatusChange]);
      return <div data-testid="job-status" />;
    });

    // Default repo has workflows ['branch', 'write'], so the default workflow is 'branch'.
    const { user } = setup(null);

    await user.click(screen.getByRole('button', { name: /Delete/i }));

    expect(await screen.findByText('Requested changes were pushed to a branch')).toBeInTheDocument();
  });

  it('shows the configured-branch success message when the job completes on the write workflow', async () => {
    mockJobStatus.mockImplementation(({ onStatusChange }) => {
      useEffect(() => {
        onStatusChange?.({ status: 'success' });
      }, [onStatusChange]);
      return <div data-testid="job-status" />;
    });

    const writeOnlyRepository: RepositoryView = {
      name: 'test-folder',
      type: 'github',
      title: 'Test Repository',
      target: 'folder',
      workflows: ['write'],
    };
    const { user } = setup(writeOnlyRepository);

    await user.click(screen.getByRole('button', { name: /Delete/i }));

    expect(await screen.findByText('Resources deleted successfully')).toBeInTheDocument();
  });
});
