import { screen, waitFor } from '@testing-library/react';
import { render } from 'test/test-utils';

import { Job, RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

import { useSelectionRepoValidation } from '../../hooks/useSelectionRepoValidation';

import { BulkDeleteProvisionedResource } from './BulkDeleteProvisionedResource';
import { ResponseType } from './useBulkActionJob';

jest.mock('app/features/browse-dashboards/components/BrowseActions/DescendantCount', () => ({
  DescendantCount: jest.fn(({ selectedItems }) => (
    <div data-testid="descendant-count">
      Mocked descendant count for {Object.keys(selectedItems.folder).length} folders and{' '}
      {Object.keys(selectedItems.dashboard).length} dashboards
    </div>
  )),
}));

jest.mock('app/features/provisioning/hooks/useGetResourceRepositoryView', () => ({
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

  it('calls createBulkJob with branch workflow parameters when branch is selected', async () => {
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

  it('calls createBulkJob with write workflow parameters when write is selected', async () => {
    const { user, mockCreateBulkJob, defaultRepository } = setup(null);

    // Switch to write workflow
    const writeRadio = screen.getByRole('radio', { name: /Save/i });
    await user.click(writeRadio);

    await user.click(screen.getByRole('button', { name: /Delete/i }));

    expect(mockCreateBulkJob).toHaveBeenCalledWith(
      defaultRepository,
      expect.objectContaining({
        action: 'delete',
        delete: expect.objectContaining({
          resources: expect.arrayContaining([
            expect.objectContaining({ name: 'folder-1', kind: 'Folder' }),
            expect.objectContaining({ name: 'dashboard-1', kind: 'Dashboard' }),
          ]),
        }),
      })
    );
  });
});
