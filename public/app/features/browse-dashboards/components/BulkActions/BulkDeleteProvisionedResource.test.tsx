import { screen, waitFor } from '@testing-library/react';
import { render } from 'test/test-utils';

import { setBackendSrv } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';
import { RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { backendSrv } from 'app/core/services/backend_srv';

import { BulkDeleteProvisionedResource } from './BulkDeleteProvisionedResource';

// Set up backendSrv as recommended in the PR comment
setBackendSrv(backendSrv);
setupMockServer();

jest.mock('../BrowseActions/DescendantCount', () => ({
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

// Get references to mocked functions after module loading
const mockUseGetResourceRepositoryView = jest.mocked(
  require('app/features/provisioning/hooks/useGetResourceRepositoryView').useGetResourceRepositoryView
);
const mockUseBulkActionJob = jest.mocked(require('./useBulkActionJob').useBulkActionJob);
const mockGetAppEvents = jest.mocked(require('@grafana/runtime').getAppEvents);

describe('BulkDeleteProvisionedResource', () => {
  const defaultRepository: RepositoryView = {
    name: 'test-folder', // This must match the folderUid passed to the component
    type: 'github',
    title: 'Test Repository',
    target: 'folder',
    workflows: ['branch', 'write'],
  };

  const selectedItems = {
    folder: { 'folder-1': true },
    dashboard: { 'dashboard-1': true },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseGetResourceRepositoryView.mockReturnValue({
      repository: defaultRepository,
      folder: {
        metadata: {
          annotations: {
            'grafana.app/file-path': '/test/folder',
          },
        },
      },
      isInstanceManaged: false,
    });

    mockUseBulkActionJob.mockReturnValue({
      createBulkJob: jest.fn(),
      isLoading: false,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function setup(
    repository: RepositoryView | null = defaultRepository,
    mockJobResult = { success: true, job: { metadata: { name: 'test-job' }, status: { state: 'success' } } },
    isLoading = false
  ) {
    const onDismiss = jest.fn();
    const mockCreateBulkJob = jest.fn().mockResolvedValue(mockJobResult);

    mockUseGetResourceRepositoryView.mockReturnValue({
      repository,
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
      ...renderResult,
    };
  }

  it('renders the delete warning and form', async () => {
    setup();

    expect(await screen.findByText(/This will delete selected folders and their descendants/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Delete/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
  });

  it('calls onDismiss when Cancel is clicked', async () => {
    const { onDismiss, user } = setup();

    await user.click(screen.getByRole('button', { name: /Cancel/i }));

    expect(onDismiss).toHaveBeenCalled();
  });

  it('handles successful deletion', async () => {
    const { user, mockCreateBulkJob } = setup();

    await user.click(screen.getByRole('button', { name: /Delete/i }));

    expect(mockCreateBulkJob).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'test-folder' }),
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
    const mockCreateBulkJob = jest.fn().mockResolvedValue({ success: false, error: 'Network error' });

    mockUseGetResourceRepositoryView.mockReturnValue({
      repository: defaultRepository,
      folder: {
        metadata: {
          annotations: {
            'grafana.app/file-path': '/test/folder',
          },
        },
      },
      isInstanceManaged: false,
    });

    mockUseBulkActionJob.mockReturnValue({
      createBulkJob: mockCreateBulkJob,
      isLoading: false,
    });

    mockGetAppEvents.mockReturnValue({
      publish: mockPublish,
    });

    const { user } = render(
      <BulkDeleteProvisionedResource folderUid="test-folder" selectedItems={selectedItems} onDismiss={jest.fn()} />
    );

    await user.click(screen.getByRole('button', { name: /Delete/i }));

    // Wait for the async function to complete
    await waitFor(() => {
      expect(mockCreateBulkJob).toHaveBeenCalled();
    });

    // Should remain on form (not show JobStatus) when there's an error
    expect(screen.queryByTestId('job-status')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Delete/i })).toBeInTheDocument();

    // Verify that getAppEvents().publish was called for error notification
    expect(mockPublish).toHaveBeenCalledWith({
      type: 'alert-error',
      payload: ['Error deleting resources', 'Network error'],
    });
  });

  it('shows loading state during deletion', async () => {
    // Setup with a pending job that will resolve to working state
    const workingJob = { metadata: { name: 'test-job' }, status: { state: 'working' } };
    const mockCreateBulkJob = jest.fn().mockResolvedValue({ success: true, job: workingJob });

    // Override mocks for this specific test
    mockUseGetResourceRepositoryView.mockReturnValue({
      repository: defaultRepository,
      folder: {
        metadata: {
          annotations: {
            'grafana.app/file-path': '/test/folder',
          },
        },
      },
      isInstanceManaged: false,
    });

    mockUseBulkActionJob.mockReturnValue({
      createBulkJob: mockCreateBulkJob,
      isLoading: false,
    });

    const { user } = render(
      <BulkDeleteProvisionedResource folderUid="test-folder" selectedItems={selectedItems} onDismiss={jest.fn()} />
    );

    await user.click(screen.getByRole('button', { name: /Delete/i }));

    // After click, should show JobStatus
    await waitFor(() => {
      expect(screen.getByTestId('job-status')).toBeInTheDocument();
    });

    expect(screen.getByText(/Job Status - delete - working/)).toBeInTheDocument();
  });
});
